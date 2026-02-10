import { randomUUID } from "node:crypto";

import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingCashierCloseCommandSchema,
  BillingCashierOpenCommandSchema,
} from "../../schemas/billing-commands.js";
import { asUuid, BillingCommandError, type CommandContext, resolveActorId, SYSTEM_ACTOR_ID } from "./common.js";

/**
 * Open a new cashier session (shift start).
 * Generates session_number, records opening float, and marks session OPEN.
 */
export const openCashierSession = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingCashierOpenCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const sessionId = randomUUID();
  const businessDate = command.business_date
    ? new Date(command.business_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Generate session number: CS-YYYYMMDD-XXXX
  const { rows: countRows } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::int AS cnt FROM cashier_sessions
     WHERE tenant_id = $1 AND property_id = $2 AND business_date = $3`,
    [tenantId, command.property_id, businessDate],
  );
  const seq = (Number(countRows[0]?.cnt ?? 0) + 1).toString().padStart(4, "0");
  const sessionNumber = `CS-${businessDate.replace(/-/g, "")}-${seq}`;

  await query(
    `INSERT INTO cashier_sessions (
       session_id, tenant_id, property_id, session_number,
       cashier_id, cashier_name, terminal_id,
       session_status, opened_at, business_date, shift_type,
       opening_float_declared, opening_float_counted,
       total_transactions, cash_transactions, card_transactions,
       total_cash_received, total_card_received, total_revenue, total_refunds,
       created_at, updated_at, created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       'open', NOW(), $8, $9,
       $10, $10,
       0, 0, 0,
       0, 0, 0, 0,
       NOW(), NOW(), $11, $11
     )`,
    [
      sessionId,
      tenantId,
      command.property_id,
      sessionNumber,
      command.cashier_id,
      command.cashier_name,
      command.terminal_id ?? null,
      businessDate,
      command.shift_type,
      command.opening_float,
      actorId,
    ],
  );

  appLogger.info(
    { sessionId, sessionNumber, cashierId: command.cashier_id },
    "Cashier session opened",
  );
  return sessionId;
};

/**
 * Close a cashier session (shift end) with automatic transaction reconciliation.
 * Aggregates all charge_postings + payments for the cashier's business date,
 * computes variance, and marks session as closed/reconciled.
 */
export const closeCashierSession = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingCashierCloseCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  // 1. Verify session exists and is open
  const { rows: sessionRows } = await query<Record<string, unknown>>(
    `SELECT session_id, session_status, property_id, cashier_id, business_date, opening_float_declared
     FROM cashier_sessions
     WHERE session_id = $1 AND tenant_id = $2`,
    [command.session_id, tenantId],
  );
  const session = sessionRows[0];
  if (!session) {
    throw new BillingCommandError(
      "SESSION_NOT_FOUND",
      `Cashier session ${command.session_id} not found`,
    );
  }
  if (session.session_status !== "open") {
    throw new BillingCommandError(
      "SESSION_NOT_OPEN",
      `Cashier session is ${session.session_status}, not open`,
    );
  }

  // 2. Aggregate transactions for this session's property + business date
  const { rows: aggRows } = await query<Record<string, unknown>>(
    `SELECT
       COUNT(*) AS total_transactions,
       COUNT(*) FILTER (WHERE payment_method = 'CASH') AS cash_transactions,
       COUNT(*) FILTER (WHERE payment_method != 'CASH') AS card_transactions,
       COALESCE(SUM(amount) FILTER (WHERE payment_method = 'CASH' AND transaction_type != 'REFUND'), 0) AS total_cash_received,
       COALESCE(SUM(amount) FILTER (WHERE payment_method != 'CASH' AND transaction_type != 'REFUND'), 0) AS total_card_received,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'REFUND'), 0) AS total_revenue,
       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'REFUND'), 0) AS total_refunds
     FROM payments
     WHERE tenant_id = $1 AND property_id = $2
       AND payment_date::date = $3::date`,
    [tenantId, session.property_id, session.business_date],
  );
  const agg = aggRows[0] ?? {};

  const openingFloat = Number(session.opening_float_declared ?? 0);
  const cashReceived = Number(agg.total_cash_received ?? 0);
  const expectedCash = openingFloat + cashReceived;
  const cashVariance = command.closing_cash_counted - expectedCash;
  const hasVariance = Math.abs(cashVariance) > 0.01;

  // 3. Update session with reconciliation data
  await query(
    `UPDATE cashier_sessions SET
       session_status = 'closed',
       closed_at = NOW(),
       total_transactions = $3,
       cash_transactions = $4,
       card_transactions = $5,
       total_cash_received = $6,
       total_card_received = $7,
       total_revenue = $8,
       total_refunds = $9,
       closing_cash_declared = $10,
       closing_cash_counted = $11,
       cash_variance = $12,
       has_variance = $13,
       reconciled = true,
       reconciled_at = NOW(),
       reconciled_by = $14,
       updated_at = NOW(),
       updated_by = $14
     WHERE session_id = $1 AND tenant_id = $2`,
    [
      command.session_id,
      tenantId,
      Number(agg.total_transactions ?? 0),
      Number(agg.cash_transactions ?? 0),
      Number(agg.card_transactions ?? 0),
      cashReceived,
      Number(agg.total_card_received ?? 0),
      Number(agg.total_revenue ?? 0),
      Number(agg.total_refunds ?? 0),
      command.closing_cash_declared,
      command.closing_cash_counted,
      cashVariance,
      hasVariance,
      actorId,
    ],
  );

  appLogger.info(
    {
      sessionId: command.session_id,
      cashVariance,
      hasVariance,
      totalTransactions: Number(agg.total_transactions ?? 0),
    },
    "Cashier session closed and reconciled",
  );
  return command.session_id;
};
