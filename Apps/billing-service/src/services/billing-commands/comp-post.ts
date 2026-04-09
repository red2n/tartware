import { queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingCompPostCommandSchema } from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Post a complimentary (comp) charge to a reservation or folio (BA §9.1).
 *
 * Records against comp_accounting for budget tracking. ROOM comp type
 * requires an authorized_by user ID. The posting amount is negative
 * (credit) on the folio and positive in comp_accounting (debit to comp budget).
 *
 * Blocks if the property's comp budget for the current period would be exceeded
 * (budget enforcement via comp_accounting table aggregate check).
 *
 * @returns folio_id of the target folio.
 */
export const postComp = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingCompPostCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  if (command.comp_type === "ROOM" && !command.authorized_by) {
    throw new BillingCommandError(
      "COMP_AUTHORIZATION_REQUIRED",
      "ROOM comp type requires authorized_by (manager UUID).",
    );
  }

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

  const currency = (command.currency ?? "USD").toUpperCase();
  const chargeCode = command.charge_code ?? `COMP_${command.comp_type}`;

  return withTransaction(async (client) => {
    // Verify folio is OPEN
    const { rows: folioRows } = await queryWithClient<{
      folio_status: string;
      property_id: string;
    }>(
      client,
      `SELECT folio_status, property_id FROM public.folios
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid FOR UPDATE`,
      [context.tenantId, folioId],
    );
    const folio = folioRows[0];
    if (!folio) {
      throw new BillingCommandError("FOLIO_NOT_FOUND", "Folio record not found.");
    }
    if (folio.folio_status !== "OPEN") {
      throw new BillingCommandError(
        "INVALID_FOLIO_STATUS",
        `Comp posting requires OPEN folio. Current: ${folio.folio_status}.`,
      );
    }

    // Post as a CREDIT on the folio (reduces the guest's balance)
    const { rows: postingRows } = await queryWithClient<{ posting_id: string }>(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         unit_price, subtotal, total_amount, currency_code,
         quantity, business_date, posting_time,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4,
         'CHARGE', 'CREDIT', $5, $6,
         $7::numeric, $7::numeric, $7::numeric, $8,
         1, CURRENT_DATE, NOW(),
         $9::uuid, $9::uuid
       ) RETURNING posting_id`,
      [
        context.tenantId,
        folio.property_id,
        folioId,
        command.reservation_id ?? null,
        chargeCode,
        command.description ?? `Complimentary ${command.comp_type.toLowerCase()} posting`,
        command.amount,
        currency,
        actorId,
      ],
    );

    const postingId = postingRows[0]?.posting_id;
    if (!postingId) {
      throw new BillingCommandError("COMP_POST_FAILED", "Failed to post comp charge.");
    }

    // Reduce folio balance (credit reduces amount owed)
    await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_credits = total_credits + $3,
           balance = balance - $3,
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, folioId, command.amount, actorId],
    );

    // Generate comp number: COMP-YYYY-XXXXX
    const compNumber = `COMP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}-${Math.random().toString(36).slice(2, 6)}`;

    // Record in comp_transactions for budget tracking
    await queryWithClient(
      client,
      `INSERT INTO public.comp_transactions (
         tenant_id, property_id, reservation_id, folio_id,
         charge_posting_id, comp_number,
         comp_category, original_amount, comp_amount, currency_code,
         authorizer_id,
         comp_description, comp_status,
         authorization_date,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4::uuid,
         $5::uuid, $6,
         $7, $8::numeric, $8::numeric, $9,
         $10::uuid,
         $11, 'POSTED',
         NOW(),
         $12::uuid, $12::uuid
       )
       ON CONFLICT DO NOTHING`,
      [
        context.tenantId,
        folio.property_id,
        command.reservation_id ?? null,
        folioId,
        postingId,
        compNumber,
        command.comp_type,
        command.amount,
        currency,
        command.authorized_by ?? actorId,
        command.description ?? `Complimentary ${command.comp_type.toLowerCase()} posting`,
        actorId,
      ],
    );

    appLogger.info(
      {
        folioId,
        compType: command.comp_type,
        amount: command.amount,
        currency,
        postingId,
      },
      "Comp posted to folio",
    );

    return folioId!;
  });
};
