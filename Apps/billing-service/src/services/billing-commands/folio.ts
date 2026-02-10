import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  type BillingFolioTransferCommand,
  BillingFolioCloseCommandSchema,
  BillingFolioTransferCommandSchema,
} from "../../schemas/billing-commands.js";
import { parseDbMoneyOrZero } from "../../utils/money.js";
import {
  type CommandContext,
  BillingCommandError,
  SYSTEM_ACTOR_ID,
  asUuid,
  resolveActorId,
  resolveFolioId,
} from "./common.js";

/**
 * Transfer folio balance between reservations.
 */
export const transferFolio = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioTransferCommandSchema.parse(payload);
  return applyFolioTransfer(command, context);
};

/**
 * Close/settle a folio. Sets folio_status to SETTLED (if balance=0)
 * or CLOSED (if balance > 0 and force=true). Blocks if balance > 0
 * without force.
 */
export const closeFolio = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioCloseCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;

  const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  if (!folioId) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "No folio found for reservation.");
  }

  // Check current folio state
  const { rows } = await query<{ folio_status: string; balance: string }>(
    `SELECT folio_status, balance FROM public.folios
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid LIMIT 1`,
    [context.tenantId, folioId],
  );
  const folio = rows[0];
  if (!folio) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "Folio record not found.");
  }
  if (folio.folio_status === "CLOSED" || folio.folio_status === "SETTLED") {
    appLogger.info({ folioId, status: folio.folio_status }, "Folio already closed/settled");
    return folioId;
  }

  const balance = parseDbMoneyOrZero(folio.balance);
  if (balance > 0 && !command.force) {
    throw new BillingCommandError(
      "FOLIO_UNSETTLED",
      `Folio has outstanding balance of ${balance.toFixed(2)}. Use force:true to close anyway.`,
    );
  }

  const newStatus = balance === 0 ? "SETTLED" : "CLOSED";
  const settledAt = newStatus === "SETTLED" ? new Date() : null;
  const settledBy = newStatus === "SETTLED" ? actorId : null;
  await query(
    `UPDATE public.folios
     SET folio_status = $3::text, closed_at = NOW(), close_reason = $4,
         settled_at = $6::timestamptz, settled_by = $7::uuid,
         updated_at = NOW(), updated_by = $5::uuid
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
    [
      context.tenantId,
      folioId,
      newStatus,
      command.close_reason ?? null,
      actorId,
      settledAt,
      settledBy,
    ],
  );

  appLogger.info(
    { folioId, newStatus, balance, reservationId: command.reservation_id },
    "Folio closed/settled",
  );
  return folioId;
};

const applyFolioTransfer = async (
  command: BillingFolioTransferCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const fromFolioId = await resolveFolioId(context.tenantId, command.from_reservation_id);
  const toFolioId = await resolveFolioId(context.tenantId, command.to_reservation_id);
  if (!fromFolioId || !toFolioId) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "Unable to locate folios for transfer.");
  }

  await withTransaction(async (client) => {
    await queryWithClient(
      client,
      `
        UPDATE public.folios
        SET
          total_credits = total_credits + $2,
          balance = balance - $2,
          transferred_to_folio_id = $3::uuid,
          transferred_at = NOW(),
          updated_at = NOW(),
          updated_by = $4::uuid
        WHERE tenant_id = $1::uuid
          AND folio_id = $5::uuid
      `,
      [context.tenantId, command.amount, toFolioId, actorId, fromFolioId],
    );

    await queryWithClient(
      client,
      `
        UPDATE public.folios
        SET
          total_charges = total_charges + $2,
          balance = balance + $2,
          transferred_from_folio_id = $3::uuid,
          transferred_at = NOW(),
          updated_at = NOW(),
          updated_by = $4::uuid
        WHERE tenant_id = $1::uuid
          AND folio_id = $5::uuid
      `,
      [context.tenantId, command.amount, fromFolioId, actorId, toFolioId],
    );
  });

  return toFolioId;
};
