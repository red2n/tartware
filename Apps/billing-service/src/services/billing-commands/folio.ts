import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingFolioCloseCommandSchema,
  BillingFolioCreateCommandSchema,
  BillingFolioMergeCommandSchema,
  BillingFolioReopenCommandSchema,
  type BillingFolioTransferCommand,
  BillingFolioTransferCommandSchema,
} from "../../schemas/billing-commands.js";
import { parseDbMoneyOrZero } from "../../utils/money.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

// ─── Folio Create ───────────────────────────────────────────────────────

/**
 * Create a standalone folio (house account, city ledger, walk-in, etc.).
 * Supports folios without a reservation — industry standard for POS,
 * company direct-bill, and internal house accounts.
 */
export const createFolio = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioCreateCommandSchema.parse(payload);
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  const folioNumber = `FOL-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const currency = command.currency ?? "USD";

  const result = await query<{ folio_id: string }>(
    `INSERT INTO public.folios (
       tenant_id, property_id, folio_number, folio_type, folio_status,
       reservation_id, guest_id, currency_code,
       tax_exempt, tax_id,
       notes, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, 'OPEN',
       $5, $6, UPPER($7),
       $8, $9,
       $10, $11, $11
     ) RETURNING folio_id`,
    [
      context.tenantId,
      command.property_id,
      folioNumber,
      command.folio_type,
      command.reservation_id ?? null,
      command.guest_id ?? null,
      currency,
      command.tax_exempt_id ? true : false,
      command.tax_exempt_id ?? null,
      command.notes ?? null,
      actor,
    ],
  );

  const folioId = result.rows[0]?.folio_id;
  if (!folioId) {
    throw new BillingCommandError("FOLIO_CREATE_FAILED", "Failed to create folio.");
  }

  appLogger.info(
    { folioId, folioType: command.folio_type, folioNumber },
    "Standalone folio created",
  );
  return folioId;
};

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

  // Resolve folio: prefer explicit folio_id, fall back to reservation lookup
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

  return withTransaction(async (client) => {
    // Lock the folio row to prevent concurrent close/settle races
    const { rows } = await queryWithClient<{ folio_status: string; balance: string }>(
      client,
      `SELECT folio_status, balance FROM public.folios
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
       FOR UPDATE`,
      [context.tenantId, folioId],
    );
    const folio = rows[0];
    if (!folio) {
      throw new BillingCommandError("FOLIO_NOT_FOUND", "Folio record not found.");
    }
    if (folio.folio_status === "CLOSED" || folio.folio_status === "SETTLED") {
      appLogger.info({ folioId, status: folio.folio_status }, "Folio already closed/settled");
      return folioId!;
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
    await queryWithClient(
      client,
      `UPDATE public.folios
       SET folio_status = $3::text, closed_at = NOW(),
           settled_at = $5::timestamptz, settled_by = $6::uuid,
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, folioId, newStatus, actorId, settledAt, settledBy],
    );

    appLogger.info(
      { folioId, newStatus, balance, reservationId: command.reservation_id },
      "Folio closed/settled",
    );
    return folioId!;
  });
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

// \u2500\u2500\u2500 Folio Reopen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/**
 * Reopen a SETTLED or CLOSED folio.
 * Required before posting adjustments, chargeback reversals, or correction charges
 * on a settled folio. The folio is set back to OPEN status and the closed_at /
 * settled_at timestamps are cleared (BA \u00a713.5).
 *
 * @returns folio_id of the reopened folio.
 */
export const reopenFolio = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioReopenCommandSchema.parse(payload);
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

  return withTransaction(async (client) => {
    const { rows } = await queryWithClient<{ folio_status: string }>(
      client,
      `SELECT folio_status FROM public.folios
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
       FOR UPDATE`,
      [context.tenantId, folioId],
    );

    const folio = rows[0];
    if (!folio) {
      throw new BillingCommandError("FOLIO_NOT_FOUND", "Folio record not found.");
    }
    if (folio.folio_status === "OPEN") {
      appLogger.info({ folioId }, "Folio is already OPEN \u2014 reopen is a no-op");
      return folioId!;
    }
    if (!["SETTLED", "CLOSED"].includes(folio.folio_status)) {
      throw new BillingCommandError(
        "INVALID_FOLIO_STATUS",
        `Cannot reopen folio in status ${folio.folio_status}. Only SETTLED or CLOSED folios can be reopened.`,
      );
    }

    await queryWithClient(
      client,
      `UPDATE public.folios
       SET folio_status = 'OPEN',
           closed_at = NULL, settled_at = NULL, settled_by = NULL,
           notes = CONCAT_WS(E'\\n', notes, $3::text),
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, folioId, `REOPENED: ${command.reason}`, actorId],
    );

    appLogger.info({ folioId, previousStatus: folio.folio_status }, "Folio reopened");
    return folioId!;
  });
};

// \u2500\u2500\u2500 Folio Merge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/**
 * Merge a source folio into a target folio (BA \u00a73.5 \u2014 group/corporate consolidation).
 * All charge postings on the source are re-attributed to the target folio.
 * The source folio balance is zeroed and its status is set to CLOSED.
 *
 * Constraints:
 * - Both folios must be OPEN.
 * - Folios must belong to the same tenant and property.
 * - The operation is irreversible \u2014 no undo pathway exists.
 *
 * @returns target_folio_id.
 */
export const mergeFolios = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioMergeCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  if (command.source_folio_id === command.target_folio_id) {
    throw new BillingCommandError("FOLIO_MERGE_INVALID", "Source and target folios must differ.");
  }

  return withTransaction(async (client) => {
    // Lock both rows in a consistent order (lower UUID first) to prevent deadlocks
    const [lockFirst, lockSecond] =
      command.source_folio_id < command.target_folio_id
        ? [command.source_folio_id, command.target_folio_id]
        : [command.target_folio_id, command.source_folio_id];

    const { rows } = await queryWithClient<{
      folio_id: string;
      folio_status: string;
      balance: string;
      property_id: string;
    }>(
      client,
      `SELECT folio_id, folio_status, balance, property_id
       FROM public.folios
       WHERE tenant_id = $1::uuid AND folio_id = ANY($2::uuid[])
       ORDER BY folio_id
       FOR UPDATE`,
      [context.tenantId, [lockFirst, lockSecond]],
    );

    if (rows.length !== 2) {
      throw new BillingCommandError("FOLIO_NOT_FOUND", "One or both folios not found.");
    }

    const source = rows.find((r) => r.folio_id === command.source_folio_id);
    const target = rows.find((r) => r.folio_id === command.target_folio_id);

    if (!source || !target) {
      throw new BillingCommandError("FOLIO_NOT_FOUND", "One or both folios could not be resolved.");
    }

    if (source.folio_status !== "OPEN" || target.folio_status !== "OPEN") {
      throw new BillingCommandError(
        "INVALID_FOLIO_STATUS",
        `Both folios must be OPEN for merge. Source: ${source.folio_status}, Target: ${target.folio_status}.`,
      );
    }

    if (source.property_id !== target.property_id) {
      throw new BillingCommandError(
        "FOLIO_MERGE_INVALID",
        "Source and target folios must belong to the same property.",
      );
    }

    const sourceBalance = parseDbMoneyOrZero(source.balance);

    // Re-attribute all source postings to the target folio
    await queryWithClient(
      client,
      `UPDATE public.charge_postings
       SET folio_id = $3::uuid,
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, command.source_folio_id, command.target_folio_id, actorId],
    );

    // Update target folio totals to absorb the source balance
    await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_charges = total_charges + $3,
           balance = balance + $3,
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, command.target_folio_id, sourceBalance, actorId],
    );

    // Zero out and close the source folio
    await queryWithClient(
      client,
      `UPDATE public.folios
       SET folio_status = 'CLOSED',
           balance = 0, total_charges = 0, total_credits = 0,
           closed_at = NOW(),
           notes = CONCAT_WS(E'\\n', notes, $3::text),
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [
        context.tenantId,
        command.source_folio_id,
        `MERGED into ${command.target_folio_id}: ${command.reason}`,
        actorId,
      ],
    );

    appLogger.info(
      {
        sourceFolioId: command.source_folio_id,
        targetFolioId: command.target_folio_id,
        transferredBalance: sourceBalance,
      },
      "Folio merge complete",
    );

    return command.target_folio_id;
  });
};
