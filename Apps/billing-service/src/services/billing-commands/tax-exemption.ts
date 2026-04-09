import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingTaxExemptionApplyCommandSchema } from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Apply a tax exemption to a folio or reservation (BA §10.2).
 *
 * Sets tax_exempt = true on the folio and records the exemption certificate
 * reference and type for audit. Does NOT retroactively reverse existing
 * tax charges — those must be voided and reposted if needed.
 *
 * @returns folio_id of the updated folio.
 */
export const applyTaxExemption = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingTaxExemptionApplyCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  let folioId = command.folio_id ?? null;
  if (!folioId && command.reservation_id) {
    folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  }
  if (!folioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      "No folio found. Provide folio_id or a valid reservation_id.",
    );
  }

  // Verify folio exists and is OPEN
  const { rows } = await query<{ folio_id: string; folio_status: string; tax_exempt: boolean }>(
    `SELECT folio_id, folio_status, tax_exempt
     FROM public.folios
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
     LIMIT 1`,
    [context.tenantId, folioId],
  );

  const folio = rows[0];
  if (!folio) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "Folio record not found.");
  }

  if (folio.folio_status !== "OPEN") {
    throw new BillingCommandError(
      "INVALID_FOLIO_STATUS",
      `Tax exemption can only be applied to OPEN folios. Current status: ${folio.folio_status}.`,
    );
  }

  if (folio.tax_exempt) {
    appLogger.info({ folioId }, "Folio is already tax exempt — updating certificate reference.");
  }

  const exemptionNote = [
    `TAX_EXEMPT: ${command.exemption_type}`,
    `Certificate: ${command.exemption_certificate}`,
    command.exemption_reason ? `Reason: ${command.exemption_reason}` : null,
    command.expiry_date ? `Expires: ${command.expiry_date}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  await query(
    `UPDATE public.folios
     SET tax_exempt = true,
         tax_id = $3,
         notes = CONCAT_WS(E'\\n', notes, $4::text),
         updated_at = NOW(), updated_by = $5::uuid
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
    [context.tenantId, folioId, command.exemption_certificate, exemptionNote, actorId],
  );

  appLogger.info(
    {
      folioId,
      exemptionType: command.exemption_type,
      certificate: command.exemption_certificate,
    },
    "Tax exemption applied to folio",
  );

  return folioId;
};
