import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingChargebackRecordCommandSchema } from "../../schemas/billing-commands.js";
import { BillingCommandError, type CommandContext, resolveActorId } from "./common.js";

/**
 * Record a processor-initiated chargeback against a completed payment.
 * Creates a refund row with chargeback fields and adjusts the folio balance.
 */
export const recordChargeback = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingChargebackRecordCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  // Find the original payment
  const { rows: paymentRows } = await query<{
    id: string;
    amount: string;
    reservation_id: string | null;
    guest_id: string | null;
    status: string;
  }>(
    `SELECT id, amount, reservation_id, guest_id, status
     FROM public.payments
     WHERE tenant_id = $1::uuid AND payment_reference = $2
     ORDER BY created_at DESC LIMIT 1`,
    [context.tenantId, command.payment_reference],
  );

  const payment = paymentRows[0];
  if (!payment) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      `No payment found with reference ${command.payment_reference}`,
    );
  }

  if (payment.status !== "COMPLETED" && payment.status !== "PARTIALLY_REFUNDED") {
    throw new BillingCommandError(
      "INVALID_PAYMENT_STATUS",
      `Cannot record chargeback on payment with status ${payment.status}`,
    );
  }

  if (command.chargeback_amount > Number(payment.amount)) {
    throw new BillingCommandError(
      "CHARGEBACK_EXCEEDS_PAYMENT",
      `Chargeback amount ${command.chargeback_amount} exceeds payment amount ${payment.amount}`,
    );
  }

  if (!payment.guest_id) {
    throw new BillingCommandError(
      "MISSING_GUEST_ID",
      `Cannot record chargeback: payment ${command.payment_reference} has no associated guest.`,
    );
  }

  // Insert a refund row with chargeback fields set
  const { rows: refundRows } = await query<{ refund_id: string }>(
    `INSERT INTO public.refunds (
       tenant_id, property_id, original_payment_id, guest_id,
       refund_amount, currency_code, refund_type, refund_method,
       reason_category, reason_description, request_source, refund_status,
       is_chargeback, chargeback_date, chargeback_reason, chargeback_reference,
       approved_at, approved_by,
       completed_at, processed_by, requested_by, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $9::uuid,
       $4, 'USD', 'DISPUTE', 'ORIGINAL_PAYMENT_METHOD',
       'DISPUTE', $5::text, 'CHARGEBACK', 'COMPLETED',
       true, COALESCE($6::date, CURRENT_DATE), $5::varchar, $7::varchar,
       NOW(), $8::uuid,
       NOW(), $8::uuid, $8::uuid, $8::uuid, $8::uuid
     ) RETURNING refund_id`,
    [
      context.tenantId,
      command.property_id,
      payment.id,
      command.chargeback_amount,
      command.chargeback_reason,
      command.chargeback_date ?? null,
      command.chargeback_reference ?? null,
      actor,
      payment.guest_id,
    ],
  );

  const refundId = refundRows[0]?.refund_id;

  // Update the original payment status
  await query(
    `UPDATE public.payments
     SET status = (CASE
       WHEN $3 >= amount THEN 'REFUNDED'
       ELSE 'PARTIALLY_REFUNDED'
     END)::payment_status,
     refund_amount = COALESCE(refund_amount, 0) + $3,
     version = version + 1,
     updated_at = NOW(), updated_by = $4::uuid
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [context.tenantId, payment.id, command.chargeback_amount, actor],
  );

  // Adjust the folio balance if a reservation is linked
  if (payment.reservation_id) {
    await query(
      `WITH target_folio AS (
         SELECT folio_id
         FROM public.folios
         WHERE tenant_id = $1::uuid
           AND reservation_id = $2::uuid
           AND folio_status != 'CLOSED'
         ORDER BY created_at DESC
         LIMIT 1
       )
       UPDATE public.folios AS f
       SET balance = f.balance + $3,
           total_payments = f.total_payments - $3,
           updated_at = NOW()
       FROM target_folio tf
       WHERE f.folio_id = tf.folio_id`,
      [context.tenantId, payment.reservation_id, command.chargeback_amount],
    );
  }

  appLogger.info(
    {
      paymentId: payment.id,
      refundId,
      chargebackAmount: command.chargeback_amount,
      reason: command.chargeback_reason,
    },
    "Chargeback recorded",
  );

  return refundId ?? payment.id;
};
