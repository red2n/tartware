import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingFolioWindowCreateCommandSchema } from "../../schemas/billing-commands.js";
import { BillingCommandError, type CommandContext, resolveActorId } from "./common.js";

/**
 * Create a folio window for date-based split billing within a single stay.
 * E.g., "company pays Mon-Fri, guest pays Sat-Sun".
 */
export const createFolioWindow = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingFolioWindowCreateCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  // Validate that the folio exists and belongs to this reservation
  const { rows: folioRows } = await query<{ folio_id: string }>(
    `SELECT folio_id FROM public.folios
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
       AND reservation_id = $3::uuid AND folio_status != 'CLOSED'
     LIMIT 1`,
    [context.tenantId, command.folio_id, command.reservation_id],
  );

  if (folioRows.length === 0) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      "Folio not found or not associated with this reservation",
    );
  }

  // Check for overlapping windows on the same folio
  const { rows: overlapRows } = await query<{ id: string }>(
    `SELECT id FROM public.folio_windows
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
       AND window_start < $4 AND window_end > $3`,
    [context.tenantId, command.folio_id, command.window_start, command.window_end],
  );

  if (overlapRows.length > 0) {
    throw new BillingCommandError(
      "WINDOW_OVERLAP",
      "A folio window already exists for the specified date range",
    );
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO public.folio_windows (
       tenant_id, property_id, reservation_id, folio_id,
       window_start, window_end, billed_to, billed_to_type,
       notes, metadata, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       $5, $6, $7, $8,
       $9, $10::jsonb, $11, $11
     ) RETURNING id`,
    [
      context.tenantId,
      command.property_id,
      command.reservation_id,
      command.folio_id,
      command.window_start,
      command.window_end,
      command.billed_to,
      command.billed_to_type,
      command.notes ?? null,
      JSON.stringify(command.metadata ?? {}),
      actor,
    ],
  );

  const windowId = rows[0]?.id;
  if (!windowId) {
    throw new BillingCommandError("WINDOW_CREATE_FAILED", "Failed to create folio window");
  }

  appLogger.info(
    {
      windowId,
      folioId: command.folio_id,
      reservationId: command.reservation_id,
      windowStart: command.window_start,
      windowEnd: command.window_end,
    },
    "Folio window created",
  );

  return windowId;
};
