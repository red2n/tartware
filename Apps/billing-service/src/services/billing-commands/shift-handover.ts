import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingCashierHandoverCommandSchema } from "../../schemas/billing-commands.js";
import { closeCashierSession, openCashierSession } from "./cashier.js";
import type { CommandContext } from "./common.js";

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

  // 1. Close the outgoing session (includes cash reconciliation)
  await closeCashierSession(
    {
      session_id: command.outgoing_session_id,
      closing_cash_declared: command.closing_cash_declared,
      closing_cash_counted: command.closing_cash_counted,
      notes: command.handover_notes ?? undefined,
    },
    context,
  );

  // 2. Persist handover notes on the closed session for audit trail
  if (command.handover_notes) {
    await query(
      `UPDATE cashier_sessions
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('handover_notes', $2::text)
       WHERE session_id = $1`,
      [command.outgoing_session_id, command.handover_notes],
    );
  }

  // 3. Open the incoming session
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
};
