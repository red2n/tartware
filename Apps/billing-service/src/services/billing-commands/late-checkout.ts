import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { acquireFolioLock } from "../../lib/folio-lock.js";
import { appLogger } from "../../lib/logger.js";
import { BillingLateCheckoutChargeCommandSchema } from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Post a late checkout fee to the reservation's folio (BA §6.2).
 *
 * Fee tier calculation (based on actual_checkout_time vs standard_checkout_time):
 *   ≤ 2h overdue → 50% of one night room rate
 *   > 2h overdue → 100% of one night room rate (full day rate)
 *
 * The override_amount bypasses tier calculation entirely.
 * Requires the reservation to be in CHECKED_IN status.
 *
 * @returns folio_id of the posting target.
 */
export const chargeLateCheckout = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingLateCheckoutChargeCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  // Validate reservation and get room rate
  const { rows: resRows } = await query<{
    reservation_id: string;
    property_id: string;
    status: string;
    room_rate: string | null;
    currency_code: string | null;
  }>(
    `SELECT id AS reservation_id, property_id, status, room_rate, currency AS currency_code
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

  if (reservation.status !== "CHECKED_IN") {
    throw new BillingCommandError(
      "INVALID_RESERVATION_STATUS",
      `Late checkout charge requires CHECKED_IN status. Current: ${reservation.status}.`,
    );
  }

  let chargeAmount: number;
  if (command.override_amount) {
    chargeAmount = command.override_amount;
  } else {
    const roomRate = reservation.room_rate ? Number(reservation.room_rate) : null;
    if (!roomRate) {
      throw new BillingCommandError(
        "LATE_CHECKOUT_AMOUNT_MISSING",
        "Cannot calculate late checkout fee: no room_rate on reservation. Use override_amount.",
      );
    }

    // Calculate minutes late relative to standard checkout time (default 12:00)
    const standardTime = command.standard_checkout_time ?? "12:00";
    const actualCheckout = new Date(command.actual_checkout_time);

    // Build a Date at standard checkout time on the same day as actual checkout
    const [stdHour, stdMinute] = standardTime.split(":").map(Number);
    const standard = new Date(actualCheckout);
    standard.setHours(stdHour ?? 12, stdMinute ?? 0, 0, 0);

    const minutesLate = (actualCheckout.getTime() - standard.getTime()) / 60_000;
    if (minutesLate <= 0) {
      throw new BillingCommandError(
        "NOT_LATE_CHECKOUT",
        "Actual checkout time is not after the standard checkout time.",
      );
    }

    // Tier: ≤ 2h → 50%, > 2h → 100%
    chargeAmount = minutesLate <= 120 ? roomRate * 0.5 : roomRate;
  }

  const currency = (command.currency ?? reservation.currency_code ?? "USD").toUpperCase();

  const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  if (!folioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      `No folio found for reservation ${command.reservation_id}.`,
    );
  }

  // Concurrency-safe posting: acquire advisory lock + SELECT FOR UPDATE inside
  // a transaction so concurrent payments/charges cannot lose updates on
  // folios.balance. Without this, an interleaved payment that reads `balance`
  // before our UPDATE commits would overwrite our increment.
  const postingId = await withTransaction(async (client) => {
    await acquireFolioLock(client, folioId);

    // Take an exclusive row lock on the folio row so any concurrent payment/charge
    // command waits for this transaction to commit before reading `balance`.
    const { rowCount: lockedCount } = await queryWithClient(
      client,
      `SELECT 1 FROM public.folios
         WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
           AND COALESCE(is_deleted, false) = false
         FOR UPDATE`,
      [context.tenantId, folioId],
    );
    if (!lockedCount) {
      throw new BillingCommandError(
        "FOLIO_NOT_FOUND",
        `Folio ${folioId} not found or has been deleted.`,
      );
    }

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
         'CHARGE', 'DEBIT', 'LATE_CHECKOUT', $5,
         $6::numeric, $6::numeric, $6::numeric, $7,
         1, CURRENT_DATE, NOW(),
         $8::uuid, $8::uuid
       ) RETURNING posting_id`,
      [
        context.tenantId,
        reservation.property_id,
        folioId,
        command.reservation_id,
        `Late checkout fee — checked out at ${command.actual_checkout_time}`,
        chargeAmount,
        currency,
        actorId,
      ],
    );

    const newPostingId = postingRows[0]?.posting_id;
    if (!newPostingId) {
      // Unexpected: INSERT succeeded without error but returned no posting_id.
      // Mark retryable — may succeed on a subsequent attempt.
      throw new BillingCommandError(
        "LATE_CHECKOUT_CHARGE_FAILED",
        "Failed to post late checkout charge.",
        true,
      );
    }

    await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_charges = total_charges + $3,
           balance = balance + $3,
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, folioId, chargeAmount, actorId],
    );

    return newPostingId;
  });

  appLogger.info(
    {
      reservationId: command.reservation_id,
      folioId,
      chargeAmount,
      currency,
      postingId,
    },
    "Late checkout charge posted",
  );

  return folioId;
};
