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
 * Does not enforce budget limits — budget tracking is for reporting only.
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
      guest_id: string | null;
    }>(
      client,
      `SELECT folio_status, property_id, guest_id FROM public.folios
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

    // Map command comp_type to the comp_category DB enum values
    const COMP_TYPE_TO_CATEGORY: Record<string, string> = {
      ROOM: "ROOM",
      FOOD_BEVERAGE: "FOOD",
      SPA: "SPA",
      ACTIVITY: "OTHER",
      MISCELLANEOUS: "OTHER",
    };
    const compCategory = COMP_TYPE_TO_CATEGORY[command.comp_type] ?? "OTHER";

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
      // Unexpected: INSERT succeeded without error but returned no posting_id.
      // Mark retryable — may succeed on a subsequent attempt (e.g. transient
      // trigger or constraint timing issue).
      throw new BillingCommandError("COMP_POST_FAILED", "Failed to post comp charge.", true);
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

    // Resolve guest_id: prefer folio.guest_id, fall back to reservation
    let guestId = folio.guest_id;
    if (!guestId && command.reservation_id) {
      const { rows: resRows } = await queryWithClient<{ guest_id: string | null }>(
        client,
        `SELECT guest_id FROM public.reservations
         WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
        [context.tenantId, command.reservation_id],
      );
      guestId = resRows[0]?.guest_id ?? null;
    }
    if (!guestId) {
      throw new BillingCommandError(
        "GUEST_NOT_FOUND",
        "guest_id could not be resolved for comp transaction. Provide a folio or reservation with a linked guest.",
      );
    }

    // Generate comp number: COMP-YYYY-XXXXX
    const compNumber = `COMP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}-${Math.random().toString(36).slice(2, 6)}`;

    // Record in comp_transactions for budget tracking
    await queryWithClient(
      client,
      `INSERT INTO public.comp_transactions (
         tenant_id, property_id, reservation_id, folio_id, guest_id,
         charge_posting_id, comp_number,
         comp_category, original_amount, comp_amount, currency_code,
         authorizer_id,
         comp_description, comp_status,
         authorization_date,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4::uuid, $5::uuid,
         $6::uuid, $7,
         $8, $9::numeric, $9::numeric, $10,
         $11::uuid,
         $12, 'POSTED',
         NOW(),
         $13::uuid, $13::uuid
       )
       ON CONFLICT DO NOTHING`,
      [
        context.tenantId,
        folio.property_id,
        command.reservation_id ?? null,
        folioId,
        guestId,
        postingId,
        compNumber,
        compCategory,
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

    return folioId as string;
  });
};
