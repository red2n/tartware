import { randomUUID } from "node:crypto";
import type { DbPool } from "@tartware/config/db";
import type {
  BillingCashierCloseCommand,
  BillingCashierHandoverCommand,
  BillingCashierOpenCommand,
} from "@tartware/schemas";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

import { asUuid, CommandError, resolveActorId, SYSTEM_ACTOR_ID } from "./command-utils.js";

type QueryFn = DbPool["query"];
type QueryWithClientFn = DbPool["queryWithClient"];
type WithTransactionFn = <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;

type CommandContext = {
  tenantId: string;
  initiatedBy?: { userId?: string } | null;
};

type LoggerLike = {
  info: (obj: unknown, msg?: string) => void;
};

/**
 * Generate a human-readable cashier session number from a business date and UUID.
 * Format: CS-YYYYMMDD-XXXXXXXX
 */
export const buildSessionNumber = (businessDate: string, sessionId: string): string =>
  `CS-${businessDate.replace(/-/g, "")}-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

/**
 * Open a new cashier session (shift start).
 * Generates session_number, records opening float, and marks session OPEN.
 *
 * @returns The new session UUID.
 */
export const openCashierSession = async (
  command: BillingCashierOpenCommand,
  context: CommandContext,
  deps: {
    query: QueryFn;
    queryWithClient: QueryWithClientFn;
    logger: LoggerLike;
    client?: PoolClient;
  },
): Promise<string> => {
  const { query, queryWithClient, logger, client } = deps;
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const sessionId = randomUUID();
  const businessDate = command.business_date
    ? new Date(command.business_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const sessionNumber = buildSessionNumber(businessDate, sessionId);

  const run = client
    ? (text: string, params: unknown[]) => queryWithClient(client, text, params)
    : (text: string, params: unknown[]) => query(text, params);

  await run(
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

  logger.info(
    { sessionId, sessionNumber, cashierId: command.cashier_id },
    "Cashier session opened",
  );
  return sessionId;
};

/**
 * Close a cashier session (shift end) with automatic payment reconciliation.
 * Aggregates all payments for the cashier's business date, computes variance,
 * and marks the session as closed/reconciled.
 *
 * @returns The closed session UUID.
 */
export const closeCashierSession = async (
  command: BillingCashierCloseCommand,
  context: CommandContext,
  deps: {
    query: QueryFn;
    queryWithClient: QueryWithClientFn;
    logger: LoggerLike;
    client?: PoolClient;
  },
): Promise<string> => {
  const { query, queryWithClient, logger, client } = deps;
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  const run = <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[],
  ): Promise<QueryResult<T>> =>
    client ? queryWithClient<T>(client, text, params) : query<T>(text, params);

  // 1. Verify session exists and is open
  const { rows: sessionRows } = await run<Record<string, unknown>>(
    `SELECT session_id, session_status, property_id, business_date, opening_float_declared, opened_at
     FROM cashier_sessions
     WHERE session_id = $1 AND tenant_id = $2`,
    [command.session_id, tenantId],
  );
  const session = sessionRows[0];
  if (!session) {
    throw new CommandError("SESSION_NOT_FOUND", `Cashier session ${command.session_id} not found`);
  }
  if (session.session_status !== "open") {
    throw new CommandError(
      "SESSION_NOT_OPEN",
      `Cashier session is ${session.session_status}, not open`,
    );
  }

  // 2. Aggregate payments processed during this session
  const { rows: aggRows } = await run<Record<string, unknown>>(
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
       AND processed_at::date = $3::date
       AND processed_at >= $4::timestamptz`,
    [tenantId, session.property_id, session.business_date, session.opened_at],
  );
  const agg = aggRows[0] ?? {};

  const cashReceived = Number(agg.total_cash_received ?? 0);
  const openingFloat = Number(session.opening_float_declared ?? 0);
  // System-expected drawer balance = opening float + cash received during shift
  const expectedCashBalance = openingFloat + cashReceived;
  // cash_variance = declared − counted (positive = shortage, negative = overage)
  const cashVariance = command.closing_cash_declared - command.closing_cash_counted;
  const hasVariance = Math.abs(cashVariance) > 0.01;

  // 3. Update session with full reconciliation data
  await run(
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
       expected_cash_balance = $12,
       cash_variance = $13,
       has_variance = $14,
       reconciled = true,
       reconciled_at = NOW(),
       reconciled_by = $15,
       updated_at = NOW(),
       updated_by = $15
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
      expectedCashBalance,
      cashVariance,
      hasVariance,
      actorId,
    ],
  );

  logger.info(
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

/**
 * Atomically close the outgoing cashier session and open an incoming one.
 * Records handover notes + cash reconciliation on the outgoing session,
 * then opens the new session with the specified (or counted) float.
 */
export const cashierHandover = async (
  command: BillingCashierHandoverCommand,
  context: CommandContext,
  deps: {
    query: QueryFn;
    queryWithClient: QueryWithClientFn;
    withTransaction: WithTransactionFn;
    logger: LoggerLike;
  },
): Promise<{ closed_session_id: string; opened_session_id: string }> => {
  const { query, queryWithClient, withTransaction, logger } = deps;
  return withTransaction(async (client) => {
    await closeCashierSession(
      {
        session_id: command.outgoing_session_id,
        closing_cash_declared: command.closing_cash_declared,
        closing_cash_counted: command.closing_cash_counted,
        notes: command.handover_notes ?? undefined,
      },
      context,
      { query, queryWithClient, logger, client },
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
      { query, queryWithClient, logger, client },
    );

    logger.info(
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
