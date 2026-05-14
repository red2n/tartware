import { cashierHandover as _cashierHandover } from "@tartware/command-consumer-utils/cashier";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingCashierHandoverCommandSchema } from "../../schemas/billing-commands.js";

import type { CommandContext } from "./common.js";

/**
 * Atomically close the outgoing cashier session and open an incoming one.
 * Delegates to the shared implementation in @tartware/command-consumer-utils.
 */
export const cashierHandover = async (
  payload: unknown,
  context: CommandContext,
): Promise<{ closed_session_id: string; opened_session_id: string }> => {
  const command = BillingCashierHandoverCommandSchema.parse(payload);
  return _cashierHandover(command, context, {
    query,
    queryWithClient,
    withTransaction,
    logger: appLogger,
  });
};
