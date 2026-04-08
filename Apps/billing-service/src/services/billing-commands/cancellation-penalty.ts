import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingCancellationPenaltyCommandSchema } from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Apply a cancellation penalty charge to a reservation's folio (BA §1.2).
 *
 * The penalty amount is derived from the reservation's rate plan cancellation
 * policy. The `penalty_amount_override` bypasses the policy lookup for
 * negotiated amounts. The charge is posted with charge_code "CANCEL_PENALTY".
 *
 * @returns folio_id of the posting target.
 */
export const chargeCancellationPenalty = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingCancellationPenaltyCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  // Load reservation + rate plan cancellation policy
  const { rows: resRows } = await query<{
    reservation_id: string;
    status: string;
    room_rate: string | null;
    currency_code: string | null;
    rate_plan_id: string | null;
  }>(
    `SELECT reservation_id, status, room_rate, currency_code, rate_plan_id
     FROM public.reservations
     WHERE tenant_id = $1::uuid AND reservation_id = $2::uuid
     LIMIT 1`,
    [context.tenantId, command.reservation_id],
  );

  const reservation = resRows[0];
  if (!reservation) {
    throw new BillingCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found.`,
    );
  }

  if (!["CANCELLED", "NO_SHOW"].includes(reservation.status)) {
    throw new BillingCommandError(
      "INVALID_RESERVATION_STATUS",
      `Cancellation penalty requires CANCELLED or NO_SHOW status. Current: ${reservation.status}.`,
    );
  }

  let penaltyAmount: number;
  if (command.penalty_amount_override) {
    penaltyAmount = command.penalty_amount_override;
  } else {
    // Derive from rate plan penalty definition (first-night charge is the standard)
    let ratePlanPenalty: number | null = null;
    if (reservation.rate_plan_id) {
      const { rows: rpRows } = await query<{ cancellation_penalty_amount: string | null }>(
        `SELECT cancellation_penalty_amount
         FROM public.rate_plans
         WHERE id = $1::uuid
         LIMIT 1`,
        [reservation.rate_plan_id],
      );
      const rp = rpRows[0];
      if (rp?.cancellation_penalty_amount) {
        ratePlanPenalty = Number(rp.cancellation_penalty_amount);
      }
    }

    // Fall back to first-night room rate
    penaltyAmount = ratePlanPenalty ?? (reservation.room_rate ? Number(reservation.room_rate) : 0);

    if (penaltyAmount <= 0) {
      throw new BillingCommandError(
        "CANCELLATION_PENALTY_UNKNOWN",
        "Cannot determine cancellation penalty. Provide penalty_amount_override or configure the rate plan.",
      );
    }
  }

  const currency = (command.currency ?? reservation.currency_code ?? "USD").toUpperCase();

  const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  if (!folioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      `No folio found for reservation ${command.reservation_id}.`,
    );
  }

  const { rows: postingRows } = await query<{ posting_id: string }>(
    `INSERT INTO public.folio_postings (
       tenant_id, folio_id, reservation_id,
       charge_code, posting_type, description,
       amount, currency_code,
       quantity, posted_at, posted_by, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid,
       'CANCEL_PENALTY', 'DEBIT', $4,
       $5::numeric, $6,
       1, NOW(), $7::uuid, $7::uuid, $7::uuid
     ) RETURNING posting_id`,
    [
      context.tenantId,
      folioId,
      command.reservation_id,
      command.reason ?? "Cancellation penalty per rate plan policy",
      penaltyAmount,
      currency,
      actorId,
    ],
  );

  const postingId = postingRows[0]?.posting_id;
  if (!postingId) {
    throw new BillingCommandError(
      "CANCELLATION_PENALTY_FAILED",
      "Failed to post cancellation penalty charge.",
    );
  }

  await query(
    `UPDATE public.folios
     SET total_charges = total_charges + $3,
         balance = balance + $3,
         updated_at = NOW(), updated_by = $4::uuid
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
    [context.tenantId, folioId, penaltyAmount, actorId],
  );

  appLogger.info(
    {
      reservationId: command.reservation_id,
      folioId,
      penaltyAmount,
      currency,
      postingId,
    },
    "Cancellation penalty posted",
  );

  return folioId;
};
