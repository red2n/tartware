import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingArAgeCommandSchema,
  BillingArApplyPaymentCommandSchema,
  BillingArPostCommandSchema,
  BillingArWriteOffCommandSchema,
} from "../../schemas/billing-commands.js";
import { addMoney, parseDbMoneyOrZero, subtractMoney } from "../../utils/money.js";
import {
  type CommandContext,
  BillingCommandError,
  SYSTEM_ACTOR_ID,
  asUuid,
  resolveActorId,
} from "./common.js";

/** Map textual payment_terms to number of days. */
const paymentTermsToDays = (terms: string): number => {
  switch (terms.toLowerCase()) {
    case "due_on_receipt":
      return 0;
    case "net_15":
      return 15;
    case "net_30":
      return 30;
    case "net_45":
      return 45;
    case "net_60":
      return 60;
    case "net_90":
      return 90;
    default:
      return 30;
  }
};

/**
 * Post an AR entry (e.g., on checkout for direct-bill guests).
 * Creates a row in accounts_receivable with status "open" and aging_bucket "current".
 */
export const postArEntry = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingArPostCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  const days = paymentTermsToDays(command.payment_terms);
  const arNumber = `AR-${Date.now()}-${randomUUID().slice(0, 8)}`;

  // look up property_id from the reservation
  const { rows: resRows } = await query<{ property_id: string }>(
    `SELECT property_id FROM reservations WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    [command.reservation_id, tenantId],
  );
  const propertyId = resRows[0]?.property_id;
  if (!propertyId) {
    throw new BillingCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found.`,
    );
  }

  const { rows } = await query<{ ar_id: string }>(
    `INSERT INTO accounts_receivable (
       tenant_id, property_id, ar_number, account_type, account_id, account_name,
       source_type, reservation_id, folio_id,
       transaction_date, due_date,
       original_amount, outstanding_balance, currency,
       ar_status, aging_bucket, payment_terms, payment_terms_days,
       notes, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5::uuid, $6,
       'reservation', $7::uuid, $8,
       CURRENT_DATE, CURRENT_DATE + $9::int,
       $10, $10, 'USD',
       'open', 'current', $11, $9,
       $12, $13::uuid, $13::uuid
     )
     RETURNING ar_id`,
    [
      tenantId,
      propertyId,
      arNumber,
      command.account_type,
      command.account_id,
      command.account_name,
      command.reservation_id,
      command.folio_id ?? null,
      days,
      command.amount,
      command.payment_terms,
      command.notes ?? null,
      actorId,
    ],
  );

  const arId = rows[0]?.ar_id ?? arNumber;
  appLogger.info(
    { arId, arNumber, amount: command.amount, accountName: command.account_name },
    "AR entry posted",
  );
  return arId;
};

/**
 * Apply a payment against an outstanding AR balance.
 */
export const applyArPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingArApplyPaymentCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  return withTransaction(async (client) => {
    // fetch and lock the AR entry
    const { rows } = await queryWithClient<{
      ar_id: string;
      outstanding_balance: string;
      paid_amount: string;
      payment_count: number;
      payments: unknown;
      ar_status: string;
    }>(
      client,
      `SELECT ar_id, outstanding_balance, paid_amount, payment_count, payments, ar_status
       FROM accounts_receivable
       WHERE ar_id = $1::uuid AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.ar_id, tenantId],
    );

    const ar = rows[0];
    if (!ar) {
      throw new BillingCommandError("AR_NOT_FOUND", `AR entry ${command.ar_id} not found.`);
    }
    if (ar.ar_status === "paid" || ar.ar_status === "written_off" || ar.ar_status === "cancelled") {
      throw new BillingCommandError("AR_CLOSED", `AR entry is already ${ar.ar_status}.`);
    }

    const outstanding = parseDbMoneyOrZero(ar.outstanding_balance);
    const paymentAmount = Math.min(command.amount, outstanding);
    const newOutstanding = subtractMoney(outstanding, paymentAmount);
    const newPaid = addMoney(parseDbMoneyOrZero(ar.paid_amount), paymentAmount);
    const newStatus = newOutstanding <= 0.005 ? "paid" : "partial";

    // append to payments JSONB array
    const existingPayments = Array.isArray(ar.payments) ? ar.payments : [];
    const paymentEntry = {
      date: (command.payment_date ?? new Date()).toISOString().slice(0, 10),
      amount: paymentAmount,
      method: command.payment_method ?? "UNKNOWN",
      reference: command.payment_reference,
    };
    const updatedPayments = [...existingPayments, paymentEntry];

    await queryWithClient(
      client,
      `UPDATE accounts_receivable
       SET outstanding_balance = $3,
           paid_amount = $4,
           ar_status = $5,
           payment_count = payment_count + 1,
           last_payment_date = $6::date,
           last_payment_amount = $7,
           payments = $8::jsonb,
           is_overdue = CASE WHEN $5 = 'paid' THEN false ELSE is_overdue END,
           updated_at = NOW(), updated_by = $9::uuid
       WHERE ar_id = $1::uuid AND tenant_id = $2::uuid`,
      [
        command.ar_id,
        tenantId,
        newOutstanding,
        newPaid,
        newStatus,
        paymentEntry.date,
        paymentAmount,
        JSON.stringify(updatedPayments),
        actorId,
      ],
    );

    appLogger.info(
      { arId: command.ar_id, paymentAmount, newOutstanding, newStatus },
      "AR payment applied",
    );
    return command.ar_id;
  });
};

/**
 * Recalculate aging buckets for all open AR entries in a property.
 */
export const ageArEntries = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingArAgeCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const asOfDate = command.as_of_date
    ? new Date(command.as_of_date).toISOString().slice(0, 10)
    : null;

  const result = await query<{ updated: string }>(
    `WITH aged AS (
       UPDATE accounts_receivable
       SET
         days_overdue = GREATEST(0, ($3::date - due_date)::int),
         is_overdue = (($3::date - due_date)::int > 0),
         aging_bucket = CASE
           WHEN ($3::date - due_date)::int <= 0 THEN 'current'
           WHEN ($3::date - due_date)::int <= 30 THEN '1_30_days'
           WHEN ($3::date - due_date)::int <= 60 THEN '31_60_days'
           WHEN ($3::date - due_date)::int <= 90 THEN '61_90_days'
           WHEN ($3::date - due_date)::int <= 120 THEN '91_120_days'
           ELSE 'over_120_days'
         END,
         aging_days = GREATEST(0, ($3::date - due_date)::int),
         ar_status = CASE
           WHEN ar_status = 'open' AND ($3::date - due_date)::int > 0 THEN 'overdue'
           WHEN ar_status = 'partial' AND ($3::date - due_date)::int > 0 THEN 'overdue'
           ELSE ar_status
         END,
         updated_at = NOW()
       WHERE tenant_id = $1::uuid
         AND property_id = $2::uuid
         AND ar_status IN ('open', 'partial', 'overdue')
         AND COALESCE(is_deleted, false) = false
       RETURNING ar_id
     )
     SELECT COUNT(*)::text AS updated FROM aged`,
    [tenantId, command.property_id, asOfDate],
  );

  const updatedCount = result.rows[0]?.updated ?? "0";
  appLogger.info({ propertyId: command.property_id, updatedCount }, "AR aging recalculated");
  return updatedCount;
};

/**
 * Write off an uncollectible AR entry.
 */
export const writeOffAr = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingArWriteOffCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  const { rows } = await query<{ ar_id: string; outstanding_balance: string }>(
    `SELECT ar_id, outstanding_balance FROM accounts_receivable
     WHERE ar_id = $1::uuid AND tenant_id = $2::uuid
       AND ar_status NOT IN ('paid', 'written_off', 'cancelled')`,
    [command.ar_id, tenantId],
  );

  const ar = rows[0];
  if (!ar) {
    throw new BillingCommandError(
      "AR_NOT_FOUND",
      `AR entry ${command.ar_id} not found or already closed.`,
    );
  }

  const outstanding = parseDbMoneyOrZero(ar.outstanding_balance);
  const writeOffAmount = Math.min(command.write_off_amount, outstanding);
  const newOutstanding = subtractMoney(outstanding, writeOffAmount);
  const newStatus = newOutstanding <= 0.005 ? "written_off" : "partial";

  await query(
    `UPDATE accounts_receivable
     SET written_off = TRUE,
         write_off_amount = COALESCE(write_off_amount, 0) + $3,
         write_off_reason = $4,
         write_off_date = CURRENT_DATE,
         written_off_by = $5::uuid,
         write_off_approved_by = $6,
         outstanding_balance = $7,
         ar_status = $8,
         is_bad_debt = CASE WHEN $8 = 'written_off' THEN TRUE ELSE is_bad_debt END,
         updated_at = NOW(), updated_by = $5::uuid
     WHERE ar_id = $1::uuid AND tenant_id = $2::uuid`,
    [
      command.ar_id,
      tenantId,
      writeOffAmount,
      command.reason,
      actorId,
      command.approved_by ?? null,
      newOutstanding,
      newStatus,
    ],
  );

  appLogger.info(
    { arId: command.ar_id, writeOffAmount, newOutstanding, newStatus },
    "AR entry written off",
  );
  return command.ar_id;
};
