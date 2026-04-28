import { randomUUID } from "node:crypto";
import type { DbPool } from "@tartware/config/db";
import type { BillingCashierOpenCommand } from "@tartware/schemas";
import type { PoolClient } from "pg";

import { asUuid, resolveActorId, SYSTEM_ACTOR_ID } from "./command-utils.js";

type QueryFn = DbPool["query"];
type QueryWithClientFn = DbPool["queryWithClient"];

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
