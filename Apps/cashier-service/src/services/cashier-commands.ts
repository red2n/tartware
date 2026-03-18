import { randomUUID } from "node:crypto";

import type { PoolClient, QueryResult, QueryResultRow } from "pg";

import { query, queryWithClient, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  BillingCashierCloseCommandSchema,
  BillingCashierHandoverCommandSchema,
  BillingCashierOpenCommandSchema,
} from "../schemas/billing-commands.js";

import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

const buildSessionNumber = (businessDate: string, sessionId: string): string =>
  `CS-${businessDate.replace(/-/g, "")}-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

const runQuery = async <T extends QueryResultRow = QueryResultRow>(
  client: PoolClient | undefined,
  text: string,
  params: unknown[],
): Promise<QueryResult<T>> =>
  client ? queryWithClient<T>(client, text, params) : query<T>(text, params);

/**
 * Open a new cashier session (shift start).
 * Generates session_number, records opening float, and marks session OPEN.
 */
export const openCashierSession = async (
  payload: unknown,
  context: CommandContext,
  client?: PoolClient,
): Promise<string> => {
  const command = BillingCashierOpenCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const sessionId = randomUUID();
  const businessDate = command.business_date
    ? new Date(command.business_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const sessionNumber = buildSessionNumber(businessDate, sessionId);

  await runQuery(
    client,
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
 * Close a cashier session (shift end).
 * Records the cash-count, computes variance, and marks session CLOSED.
 */
export const closeCashierSession = async (
  payload: unknown,
  context: CommandContext,
  client?: PoolClient,
): Promise<void> => {
  const command = BillingCashierCloseCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  const cashDeclared = command.closing_cash_declared ?? command.closing_cash_counted;
  const cashCounted = command.closing_cash_counted;

  const { rowCount } = await runQuery(
    client,
    `UPDATE cashier_sessions
     SET session_status = 'closed',
         closed_at = NOW(),
         closing_cash_declared = $3,
         closing_cash_counted = $4,
         cash_variance = COALESCE($4, 0) - COALESCE(expected_cash_balance, 0),
         has_variance = (COALESCE($4, 0) - COALESCE(expected_cash_balance, 0)) != 0,
         reconciled = (COALESCE($4, 0) - COALESCE(expected_cash_balance, 0)) = 0,
         notes = COALESCE($5, notes),
         updated_at = NOW(),
         updated_by = $6::uuid
     WHERE session_id = $1::uuid
       AND tenant_id = $2::uuid
       AND session_status = 'open'`,
    [
      command.session_id,
      context.tenantId,
      cashDeclared,
      cashCounted,
      command.notes ?? null,
      actorId,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new BillingCommandError(
      "SESSION_NOT_FOUND_OR_ALREADY_CLOSED",
      `Cashier session ${command.session_id} not found or already closed.`,
    );
  }

  appLogger.info({ sessionId: command.session_id }, "Cashier session closed");
};

/**
 * Atomically close the outgoing cashier session and open an incoming one.
 * Records handover notes + cash reconciliation on the outgoing session,
 * then opens the new session with the specified (or counted) float.
 */
export const cashierHandover = async (
  payload: unknown,
  context: CommandContext,
): Promise<{ closed_session_id: string; opened_session_id: string }> => {
  const command = BillingCashierHandoverCommandSchema.parse(payload);
  return withTransaction(async (client) => {
    await closeCashierSession(
      {
        session_id: command.outgoing_session_id,
        closing_cash_declared: command.closing_cash_declared,
        closing_cash_counted: command.closing_cash_counted,
        notes: command.handover_notes ?? undefined,
      },
      context,
      client,
    );

    if (command.handover_notes) {
      await queryWithClient(
        client,
        `UPDATE cashier_sessions
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('handover_notes', $2::text)
         WHERE session_id = $1::uuid
           AND tenant_id = $3::uuid`,
        [command.outgoing_session_id, command.handover_notes, context.tenantId],
      );
    }

    const incomingFloat = command.incoming_opening_float ?? command.closing_cash_counted;
    const newSessionId = await openCashierSession(
      {
        property_id: command.property_id,
        cashier_id: command.incoming_cashier_id,
        cashier_name: command.incoming_cashier_name,
        terminal_id: command.incoming_terminal_id ?? undefined,
        shift_type: command.incoming_shift_type,
        opening_float: incomingFloat,
      },
      context,
      client,
    );

    appLogger.info(
      {
        closedSessionId: command.outgoing_session_id,
        openedSessionId: newSessionId,
        incomingCashier: command.incoming_cashier_name,
      },
      "Cashier shift handover completed",
    );

    return {
      closed_session_id: command.outgoing_session_id,
      opened_session_id: newSessionId,
    };
  });
};
