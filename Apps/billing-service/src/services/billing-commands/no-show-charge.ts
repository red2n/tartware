import { auditAsync } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { lookupChargeCodeMapping, postGlPair } from "../../lib/gl-posting.js";
import { appLogger } from "../../lib/logger.js";
import { BillingNoShowChargeCommandSchema } from "../../schemas/billing-commands.js";

import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Post a no-show penalty charge for a reservation that was not cancelled
 * and the guest failed to arrive (BA §1.1).
 *
 * Charge amount is the first-night room rate from the reservation record
 * unless explicitly overridden by the caller. The posting uses charge_code
 * "NO_SHOW" and is applied to the guest's folio.
 *
 * @returns folio_id of the posting target.
 */
export const chargeNoShow = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingNoShowChargeCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  // Validate reservation exists and is in CONFIRMED status (not yet checked-in)
  const { rows: resRows } = await query<{
    reservation_id: string;
    property_id: string;
    status: string;
    room_rate: string | null;
    currency: string | null;
    version: number;
  }>(
    `SELECT id AS reservation_id, property_id, status, room_rate, currency, version
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

  if (!["CONFIRMED", "NO_SHOW"].includes(reservation.status)) {
    throw new BillingCommandError(
      "INVALID_RESERVATION_STATUS",
      `No-show charge requires CONFIRMED or NO_SHOW status. Current: ${reservation.status}.`,
    );
  }

  const chargeAmount =
    command.charge_amount ?? (reservation.room_rate ? Number(reservation.room_rate) : null);
  if (!chargeAmount || chargeAmount <= 0) {
    throw new BillingCommandError(
      "NO_SHOW_CHARGE_AMOUNT_MISSING",
      "Cannot determine no-show charge amount. Provide charge_amount or ensure room_rate is set on the reservation.",
    );
  }

  const currency = (command.currency ?? reservation.currency ?? "USD").toUpperCase();

  // Resolve the folio for this reservation—or create a ledger entry if no folio exists
  const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  if (!folioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      `No folio found for reservation ${command.reservation_id}. Cannot post no-show charge.`,
    );
  }

  // Insert the charge posting + GL pair atomically
  const chargeCode = command.reason_code ?? "NO_SHOW";
  const description = `No-show penalty charge — ${chargeCode}`;
  const businessDate = new Date().toISOString().slice(0, 10);

  const postingId = await withTransaction(async (client) => {
    const { rows: postingRows } = await queryWithClient<{ posting_id: string }>(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type,
         charge_code, charge_description,
         unit_price, subtotal, total_amount, currency_code,
         quantity, business_date, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'CHARGE', 'DEBIT',
         $5, $6,
         $7::numeric, $7::numeric, $7::numeric, $8,
         1, CURRENT_DATE, $9, $9
       ) RETURNING posting_id`,
      [
        context.tenantId,
        reservation.property_id,
        folioId,
        command.reservation_id,
        chargeCode,
        description,
        chargeAmount,
        currency,
        actorId,
      ],
    );

    const id = postingRows[0]?.posting_id;
    if (!id) {
      throw new BillingCommandError("NO_SHOW_CHARGE_FAILED", "Failed to post no-show charge.");
    }

    // Update folio balance inside the same transaction
    await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_charges = total_charges + $3::numeric,
           balance = balance + GREATEST(0, $3::numeric - credit_balance),
           credit_balance = GREATEST(0, credit_balance - $3::numeric),
           updated_at = NOW(), updated_by = $4::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, folioId, chargeAmount, actorId],
    );

    // GL posting (USALI double-entry): DR Guest Ledger (1100) / CR revenue per mapping.
    // Falls back to 4900 (Other Revenue) if charge code mapping is missing.
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
      amount: chargeAmount,
      currency,
      posting_date: businessDate,
      usali_category: glMapping?.usali ?? "No-Show Revenue",
      department_code: glMapping?.department ?? undefined,
      description,
      source_table: "charge_postings",
      source_id: id,
      reference_number: chargeCode,
      created_by: actorId,
    });

    // Mark reservation as NO_SHOW if still CONFIRMED
    if (reservation.status === "CONFIRMED") {
      const { rowCount } = await queryWithClient(
        client,
        `UPDATE public.reservations
         SET status = 'NO_SHOW', updated_at = NOW(), updated_by = $3::uuid, version = version + 1
         WHERE tenant_id = $1::uuid AND id = $2::uuid AND version = $4`,
        [context.tenantId, command.reservation_id, actorId, reservation.version],
      );

      if (rowCount === 0) {
        throw new BillingCommandError(
          "CONCURRENT_MODIFICATION",
          `Reservation ${command.reservation_id} was modified by another transaction.`,
          true,
        );
      }
    }

    return id;
  });

  appLogger.info(
    {
      reservationId: command.reservation_id,
      folioId,
      chargeAmount,
      currency,
      postingId,
    },
    "No-show charge posted",
  );

  auditAsync({
    tenantId: context.tenantId,
    userId: actorId ?? "00000000-0000-0000-0000-000000000000",
    action: "NO_SHOW_CHARGE_POSTED",
    entityType: "charge_posting",
    entityId: postingId,
    severity: "WARNING",
    description: `No-show charge posted to folio ${folioId}: ${chargeAmount} ${currency}`,
    newValues: { folioId, chargeAmount, currency, reservationId: command.reservation_id },
    metadata: { chargeCode: "NO_SHOW" },
  });

  return folioId;
};
