import {
  closeCashierSession as _closeCashierSession,
  openCashierSession as _openCashierSession,
} from "@tartware/command-consumer-utils/cashier";
import type { PoolClient } from "pg";

import { query, queryWithClient } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingCashierCloseCommandSchema,
  BillingCashierOpenCommandSchema,
} from "../../schemas/billing-commands.js";

import type { CommandContext } from "./common.js";

/**
 * Open a new cashier session (shift start).
 * Delegates to the shared implementation in @tartware/command-consumer-utils.
 */
export const openCashierSession = async (
  payload: unknown,
  context: CommandContext,
  client?: PoolClient,
): Promise<string> => {
  const command = BillingCashierOpenCommandSchema.parse(payload);
  return _openCashierSession(command, context, {
    query,
    queryWithClient,
    logger: appLogger,
    client,
  });
};

/**
 * Close a cashier session (shift end) with full payment reconciliation.
 * Delegates to the shared implementation in @tartware/command-consumer-utils.
 */
export const closeCashierSession = async (
  payload: unknown,
  context: CommandContext,
  client?: PoolClient,
): Promise<string> => {
  const command = BillingCashierCloseCommandSchema.parse(payload);
  return _closeCashierSession(command, context, {
    query,
    queryWithClient,
    logger: appLogger,
    client,
  });
};
