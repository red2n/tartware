import { randomUUID } from "node:crypto";

import { auditAsync } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { postGlPair } from "../../lib/gl-posting.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingDepositRecordCommandSchema,
  BillingDepositRefundCommandSchema,
  BillingDepositTransferCommandSchema,
  BillingDepositWaiveCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

// ─── GL account constants (USALI 12th Ed) ────────────────────────────────────
const CASH_ACCOUNT = "1100"; // Cash / Bank
const ADVANCE_DEPOSIT_LIABILITY = "2200"; // Guest Deposits Liability
const GUEST_LEDGER_ACCOUNT = "1100"; // Guest Ledger (same as Cash for offset)

// ─── Record a deposit payment ─────────────────────────────────────────────────

/**
 * Record receipt of an advance deposit against a deposit schedule entry.
 *
 * GL: DR Cash (1100) / CR Advance Deposit Liability (2200)
 * Creates a payment row (transaction_type = ADVANCE_DEPOSIT) and marks the
 * matching deposit_schedules row as PAID (or PARTIALLY_PAID).
 */
export const recordDeposit = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingDepositRecordCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Validate reservation exists and get property_id
  const { rows: resRows } = await query<{ property_id: string; guest_id: string | null }>(
    `SELECT property_id, guest_id FROM reservations WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    [command.reservation_id, tenantId],
  );
  const res = resRows[0];
  if (!res) {
    throw new BillingCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found.`,
    );
  }

  const paymentRef = `DEP-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`.toUpperCase();

  const { rows } = await withTransaction(async (client) => {
    // 1. Insert payment record for the deposit
    const inserted = await queryWithClient<{ payment_id: string }>(
      client,
      `INSERT INTO payments (
          tenant_id, property_id, reservation_id, guest_id,
          payment_reference, payment_method, transaction_type,
          amount, currency_code, payment_status,
          notes, created_by, updated_by
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4,
          $5, $6, 'ADVANCE_DEPOSIT',
          $7, UPPER($8), 'COMPLETED',
          $9, $10::uuid, $10::uuid
        ) RETURNING payment_id`,
      [
        tenantId,
        res.property_id,
        command.reservation_id,
        res.guest_id ?? null,
        paymentRef,
        command.payment_method,
        command.amount,
        command.currency,
        command.notes ?? null,
        actorId,
      ],
    );

    const paymentId = inserted.rows[0]?.payment_id;
    if (!paymentId) {
      throw new BillingCommandError("DEPOSIT_RECORD_FAILED", "Failed to insert deposit payment.");
    }

    // 2. Update deposit schedule if provided
    if (command.schedule_id) {
      await queryWithClient(
        client,
        `UPDATE deposit_schedules
            SET amount_paid      = amount_paid + $1,
                amount_remaining = GREATEST(amount_remaining - $1, 0),
                schedule_status  = CASE
                  WHEN amount_remaining - $1 <= 0 THEN 'PAID'::varchar
                  ELSE 'PARTIALLY_PAID'::varchar
                END,
                paid_at   = NOW(),
                paid_by   = $2::uuid,
                updated_at = NOW()
          WHERE schedule_id = $3::uuid AND tenant_id = $4::uuid`,
        [command.amount, actorId, command.schedule_id, tenantId],
      );
    }

    // 3. GL posting: DR Cash (1100) / CR Advance Deposit Liability (2200)
    const { rows: dateRows } = await queryWithClient<{ today: string }>(
      client,
      "SELECT CURRENT_DATE::text AS today",
      [],
    );
    const postingDate = dateRows[0]?.today ?? new Date().toISOString().slice(0, 10);

    await postGlPair(client, {
      tenant_id: tenantId,
      property_id: res.property_id,
      reservation_id: command.reservation_id,
      debit_account: CASH_ACCOUNT,
      credit_account: ADVANCE_DEPOSIT_LIABILITY,
      amount: command.amount,
      currency: command.currency,
      posting_date: postingDate,
      usali_category: "Advance Deposits",
      description: `Deposit received — ${paymentRef}`,
      source_table: "payments",
      source_id: paymentId,
      reference_number: paymentRef,
      created_by: actorId,
    });

    return inserted;
  });

  const depositPaymentId = rows[0]?.payment_id ?? paymentRef;
  appLogger.info(
    { depositPaymentId, paymentRef, reservationId: command.reservation_id, amount: command.amount },
    "Advance deposit recorded",
  );
  auditAsync({
    tenantId,
    propertyId: res.property_id,
    userId: actorId,
    action: "DEPOSIT_RECORD",
    entityType: "payment",
    entityId: depositPaymentId,
    severity: "INFO",
    description: `Deposit ${paymentRef} of ${command.amount} ${command.currency} recorded`,
    newValues: { amount: command.amount, schedule_id: command.schedule_id ?? null },
  });
  return depositPaymentId;
};

// ─── Transfer deposit to folio credit at check-in ────────────────────────────

/**
 * Convert advance deposit liability into a folio credit at check-in.
 *
 * GL: DR Advance Deposit Liability (2200) / CR Guest Ledger (1100)
 * All ADVANCE_DEPOSIT payments for the reservation are transferred unless
 * specific `deposit_ids` are supplied.
 */
export const transferDeposit = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingDepositTransferCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Load deposits to transfer
  const depositFilter = command.deposit_ids ? `AND payment_id = ANY($3::uuid[])` : ``;
  const depositParams: unknown[] = [tenantId, command.reservation_id];
  if (command.deposit_ids) {
    depositParams.push(command.deposit_ids);
  }

  const { rows: deposits } = await query<{
    payment_id: string;
    amount: string;
    currency_code: string;
    property_id: string;
  }>(
    `SELECT payment_id, amount, currency_code, property_id
       FROM payments
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND transaction_type = 'ADVANCE_DEPOSIT'
        AND payment_status = 'COMPLETED' ${depositFilter}`,
    depositParams,
  );

  if (deposits.length === 0) {
    throw new BillingCommandError(
      "NO_DEPOSITS_FOUND",
      "No completed advance deposits found for this reservation.",
    );
  }

  const { rows } = await withTransaction(async (client) => {
    const { rows: dateRows } = await queryWithClient<{ today: string }>(
      client,
      "SELECT CURRENT_DATE::text AS today",
      [],
    );
    const postingDate = dateRows[0]?.today ?? new Date().toISOString().slice(0, 10);

    for (const deposit of deposits) {
      const amount = Number(deposit.amount);
      const transferRef = `DEP-XFR-${randomUUID().slice(0, 8)}`.toUpperCase();

      // Insert credit posting to folio
      await queryWithClient(
        client,
        `INSERT INTO charge_postings (
            tenant_id, property_id, folio_id, reservation_id,
            charge_code, charge_description, posting_type,
            quantity, unit_price, subtotal, total_amount, currency_code,
            posting_date, reference_number,
            notes, created_by, updated_by
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid,
            'DEPOSIT_APPLIED', 'Advance Deposit Applied', 'CREDIT',
            1, $5, $5, $5, UPPER($6),
            $7::date, $8,
            $9, $10::uuid, $10::uuid
          )`,
        [
          tenantId,
          deposit.property_id,
          command.folio_id,
          command.reservation_id,
          amount,
          deposit.currency_code,
          postingDate,
          transferRef,
          command.notes ?? `Deposit transferred at check-in`,
          actorId,
        ],
      );

      // GL: DR Advance Deposit Liability (2200) / CR Guest Ledger (1100)
      await postGlPair(client, {
        tenant_id: tenantId,
        property_id: deposit.property_id,
        folio_id: command.folio_id,
        reservation_id: command.reservation_id,
        debit_account: ADVANCE_DEPOSIT_LIABILITY,
        credit_account: GUEST_LEDGER_ACCOUNT,
        amount,
        currency: deposit.currency_code,
        posting_date: postingDate,
        usali_category: "Advance Deposits",
        description: `Deposit applied to folio — ${transferRef}`,
        source_table: "payments",
        source_id: deposit.payment_id,
        reference_number: transferRef,
        created_by: actorId,
      });

      // Mark payment as applied
      await queryWithClient(
        client,
        `UPDATE payments SET payment_status = 'APPLIED', updated_at = NOW(), updated_by = $1::uuid
          WHERE payment_id = $2::uuid AND tenant_id = $3::uuid`,
        [actorId, deposit.payment_id, tenantId],
      );
    }

    return { rows: deposits };
  });

  appLogger.info(
    { count: rows.length, folioId: command.folio_id, reservationId: command.reservation_id },
    "Advance deposits transferred to folio",
  );
  return command.folio_id;
};

// ─── Refund a deposit ────────────────────────────────────────────────────────

/**
 * Refund an advance deposit back to the guest.
 *
 * GL: DR Advance Deposit Liability (2200) / CR Cash (1100)
 */
export const refundDeposit = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingDepositRefundCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Load deposit(s) to refund — use deposit_id if provided, else latest for reservation
  const { rows: depRows } = await query<{
    payment_id: string;
    amount: string;
    currency_code: string;
    property_id: string;
    reservation_id: string;
  }>(
    `SELECT payment_id, amount, currency_code, property_id, reservation_id
       FROM payments
      WHERE tenant_id = $1::uuid
        AND (payment_id = $2::uuid OR $2 IS NULL)
        AND ($2 IS NOT NULL OR reservation_id = $3::uuid)
        AND transaction_type = 'ADVANCE_DEPOSIT' AND payment_status = 'COMPLETED'
      ORDER BY created_at DESC LIMIT 1`,
    [tenantId, command.deposit_id ?? null, command.reservation_id],
  );

  const dep = depRows[0];
  if (!dep) {
    throw new BillingCommandError(
      "DEPOSIT_NOT_FOUND",
      "Deposit not found or already applied/refunded.",
    );
  }

  const refundAmount = command.amount ?? Number(dep.amount);
  const refundRef = `DEP-REF-${randomUUID().slice(0, 8)}`.toUpperCase();

  await withTransaction(async (client) => {
    // Insert refund record
    await queryWithClient(
      client,
      `INSERT INTO refunds (
          tenant_id, property_id, payment_id, reservation_id,
          refund_reference, refund_method, refund_type,
          refund_amount, currency_code, refund_status,
          reason, notes, created_by, updated_by
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid,
          $5, 'ORIGINAL_PAYMENT', 'DEPOSIT_REFUND',
          $6, UPPER($7), 'COMPLETED',
          $8, NULL, $9::uuid, $9::uuid
        )`,
      [
        tenantId,
        dep.property_id,
        dep.payment_id,
        dep.reservation_id,
        refundRef,
        refundAmount,
        dep.currency_code,
        command.reason ?? "Deposit refund",
        actorId,
      ],
    );

    // Mark original deposit as refunded
    await queryWithClient(
      client,
      `UPDATE payments SET payment_status = 'REFUNDED', updated_at = NOW(), updated_by = $1::uuid
        WHERE payment_id = $2::uuid AND tenant_id = $3::uuid`,
      [actorId, dep.payment_id, tenantId],
    );

    // GL: DR Advance Deposit Liability (2200) / CR Cash (1100)
    const { rows: dateRows } = await queryWithClient<{ today: string }>(
      client,
      "SELECT CURRENT_DATE::text AS today",
      [],
    );
    const postingDate = dateRows[0]?.today ?? new Date().toISOString().slice(0, 10);

    await postGlPair(client, {
      tenant_id: tenantId,
      property_id: dep.property_id,
      reservation_id: dep.reservation_id,
      debit_account: ADVANCE_DEPOSIT_LIABILITY,
      credit_account: CASH_ACCOUNT,
      amount: refundAmount,
      currency: dep.currency_code,
      posting_date: postingDate,
      usali_category: "Advance Deposits",
      description: `Deposit refunded — ${refundRef}`,
      source_table: "other",
      source_id: dep.payment_id,
      reference_number: refundRef,
      created_by: actorId,
    });
  });

  appLogger.info({ refundRef, depositId: dep.payment_id, refundAmount }, "Deposit refunded");
  return refundRef;
};

// ─── Waive a deposit schedule entry ──────────────────────────────────────────

/**
 * Waive a deposit schedule entry (no GL movement — administrative action only).
 *
 * Use when a deposit requirement is forgiven by management (e.g., loyalty guest,
 * complimentary stay). Records the waiver and the actor for audit trail.
 */
export const waiveDeposit = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingDepositWaiveCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rowCount } = await query(
    `UPDATE deposit_schedules
        SET schedule_status = 'WAIVED',
            waiver_reason   = $1,
            waived_at       = NOW(),
            waived_by       = $2::uuid,
            updated_at      = NOW()
      WHERE schedule_id = $3::uuid AND tenant_id = $4::uuid
        AND schedule_status NOT IN ('PAID', 'WAIVED', 'CANCELLED')`,
    [command.reason ?? "Management waiver", actorId, command.schedule_id, tenantId],
  );

  if (!rowCount || rowCount === 0) {
    throw new BillingCommandError(
      "DEPOSIT_WAIVE_FAILED",
      `Deposit schedule ${command.schedule_id} not found or not in a waivable state.`,
    );
  }

  appLogger.info({ scheduleId: command.schedule_id }, "Deposit schedule waived");
  return command.schedule_id;
};
