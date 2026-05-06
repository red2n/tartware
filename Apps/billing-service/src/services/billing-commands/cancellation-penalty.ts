import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { lookupChargeCodeMapping, postGlPair } from "../../lib/gl-posting.js";
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
    property_id: string;
    status: string;
    room_rate: string | null;
    currency_code: string | null;
    rate_id: string | null;
  }>(
    `SELECT id AS reservation_id, property_id, status, room_rate, currency AS currency_code, rate_id
     FROM public.reservations
     WHERE tenant_id = $1::uuid AND id = $2::uuid
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
    // Derive from rate cancellation policy (first-night charge is the standard)
    let ratePenalty: number | null = null;
    if (reservation.rate_id) {
      const { rows: rateRows } = await query<{ penalty_amount: string | null }>(
        `SELECT (cancellation_policy->>'penalty')::text AS penalty_amount
         FROM public.rates
         WHERE id = $1::uuid AND tenant_id = $2::uuid
         LIMIT 1`,
        [reservation.rate_id, context.tenantId],
      );
      const rate = rateRows[0];
      if (rate?.penalty_amount) {
        const parsed = Number(rate.penalty_amount);
        if (Number.isFinite(parsed)) {
          ratePenalty = parsed;
        }
      }
    }

    // Fall back to first-night room rate
    penaltyAmount = ratePenalty ?? (reservation.room_rate ? Number(reservation.room_rate) : 0);

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

  const description = command.reason ?? "Cancellation penalty per rate plan policy";
  // CANCEL_FEE matches the seeded charge_code_gl_mapping entry for cancellation revenue.
  const chargeCode = "CANCEL_FEE";

  const postingId = await withTransaction(async (client) => {
    // Derive business date from DB CURRENT_DATE to stay in sync with the transaction.
    const { rows: dateRows } = await queryWithClient<{ today: string }>(
      client,
      "SELECT CURRENT_DATE::text AS today",
      [],
    );
    const businessDate = dateRows[0]?.today ?? new Date().toISOString().slice(0, 10);
    const { rows: postingRows } = await queryWithClient<{ posting_id: string }>(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         unit_price, subtotal, total_amount, currency_code,
         quantity, business_date, posting_time,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'CHARGE', 'DEBIT', $5, $6,
         $7::numeric, $7::numeric, $7::numeric, $8,
         1, CURRENT_DATE, NOW(),
         $9::uuid, $9::uuid
       ) RETURNING posting_id`,
      [
        context.tenantId,
        reservation.property_id,
        folioId,
        command.reservation_id,
        chargeCode,
        description,
        penaltyAmount,
        currency,
        actorId,
      ],
    );

    const id = postingRows[0]?.posting_id;
    if (!id) {
      throw new BillingCommandError(
        "CANCELLATION_PENALTY_FAILED",
        "Failed to post cancellation penalty charge.",
      );
    }

    await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_charges = total_charges + $3,
           balance = balance + $3,
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, folioId, penaltyAmount, actorId],
    );

    // GL posting (USALI double-entry): DR Guest Ledger / CR cancellation revenue.
    const glMapping = await lookupChargeCodeMapping(client, context.tenantId, chargeCode);
    const debitAccount = glMapping?.debit ?? "1100";
    const creditAccount = glMapping?.credit ?? "4900";
    await postGlPair(client, {
      tenant_id: context.tenantId,
      property_id: reservation.property_id,
      folio_id: folioId,
      reservation_id: command.reservation_id,
      debit_account: debitAccount,
      credit_account: creditAccount,
      amount: penaltyAmount,
      currency,
      posting_date: businessDate,
      usali_category: glMapping?.usali ?? "Cancellation Revenue",
      department_code: glMapping?.department ?? undefined,
      description,
      source_table: "charge_postings",
      source_id: id,
      reference_number: chargeCode,
      created_by: actorId,
    });

    return id;
  });

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
