import { queryWithClient, withTransaction } from "../../lib/db.js";
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
