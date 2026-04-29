import { queryWithClient, withTransaction } from "../../lib/db.js";
import { acquireFolioLock } from "../../lib/folio-lock.js";
import { appLogger } from "../../lib/logger.js";
import { BillingExpressCheckoutCommandSchema } from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
} from "./common.js";

const logger = appLogger.child({ module: "express-checkout" });

/**
 * Express checkout: verify zero/near-zero balance, close the folio,
 * update room status to dirty, and mark the reservation checked-out.
 * The `send_folio_email` flag is currently advisory only and reserved
 * for downstream notification integration.
 */
export const expressCheckout = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = BillingExpressCheckoutCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info({ tenantId, reservationId: command.reservation_id }, "starting express checkout");

  // 1. Resolve folio (outside transaction — read-only lookup)
  const folioId = command.folio_id ?? (await resolveFolioId(tenantId, command.reservation_id));

  if (!folioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      `No folio found for reservation ${command.reservation_id}`,
    );
  }

  await withTransaction(async (client) => {
    // 2. Acquire advisory lock — prevents concurrent payment/charge mutations on this
    //    folio while checkout is in progress. Throws FOLIO_LOCKED (retryable) if
    //    another operation holds the lock after 5 seconds.
    await acquireFolioLock(client, folioId);

    // 3. Check folio balance inside the transaction with FOR UPDATE so no
    //    concurrent payment can slip in between the read and the close.
    if (!command.skip_balance_check) {
      const { rows: balanceRows } = await queryWithClient<{ balance: number }>(
        client,
        `SELECT COALESCE(balance, 0) AS balance
			   FROM folios
			   WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
			     AND COALESCE(is_deleted, false) = false
			   FOR UPDATE`,
        [tenantId, folioId],
      );

      const balance = balanceRows[0]?.balance ?? 0;
      if (balance > 0) {
        throw new BillingCommandError(
          "BALANCE_NOT_ZERO",
          `Folio ${folioId} has outstanding balance of ${balance}. Settle before express checkout.`,
        );
      }
    }

    // 4. Close the folio
    await queryWithClient(
      client,
      `UPDATE folios
		   SET folio_status = 'CLOSED',
		       closed_at = NOW(),
		       updated_at = NOW(),
		       updated_by = $3::uuid
		   WHERE tenant_id = $1::uuid
		     AND folio_id = $2::uuid
		     AND folio_status != 'CLOSED'`,
      [tenantId, folioId, asUuid(actorId)],
    );

    // 5. Get the room number from the reservation to update room status
    const { rows: resRows } = await queryWithClient<{ room_number: string | null }>(
      client,
      `SELECT room_number
		   FROM reservations
		   WHERE tenant_id = $1::uuid
		     AND id = $2::uuid`,
      [tenantId, command.reservation_id],
    );

    const roomNumber = resRows[0]?.room_number;

    // 6. Update reservation status to checked_out
    await queryWithClient(
      client,
      `UPDATE reservations
		   SET status = 'CHECKED_OUT',
		       actual_check_out = NOW(),
		       updated_at = NOW(),
		       updated_by = $3::uuid
		   WHERE tenant_id = $1::uuid
		     AND id = $2::uuid
		     AND status = 'CHECKED_IN'`,
      [tenantId, command.reservation_id, asUuid(actorId)],
    );

    // 7. Update room status to dirty (needs housekeeping)
    if (roomNumber) {
      await queryWithClient(
        client,
        `UPDATE rooms
			   SET housekeeping_status = 'DIRTY',
			       status = 'DIRTY',
			       updated_at = NOW(),
			       updated_by = $3::uuid
			   WHERE tenant_id = $1::uuid
			     AND property_id = $2::uuid
			     AND room_number = $4
			     AND COALESCE(is_deleted, false) = false`,
        [tenantId, command.property_id, asUuid(actorId), roomNumber],
      );
    }

    logger.info(
      {
        tenantId,
        reservationId: command.reservation_id,
        folioId,
        roomNumber,
        sendEmail: command.send_folio_email,
      },
      "express checkout completed",
    );
  });
};
