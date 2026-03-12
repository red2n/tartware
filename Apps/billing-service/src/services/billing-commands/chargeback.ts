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
    status: string;
  }>(
    `SELECT id, amount, reservation_id, status
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

  // Insert a refund row with chargeback fields set
  const { rows: refundRows } = await query<{ id: string }>(
    `INSERT INTO public.refunds (
       tenant_id, property_id, payment_id, refund_amount, currency,
       refund_reason, request_source, status,
       is_chargeback, chargeback_date, chargeback_reason, chargeback_reference,
       processed_at, processed_by, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4, 'USD',
       $5, 'CHARGEBACK', 'COMPLETED',
       true, COALESCE($6, CURRENT_DATE), $5, $7,
       NOW(), $8, $8, $8
     ) RETURNING id`,
    [
      context.tenantId,
      command.property_id,
      payment.id,
      command.chargeback_amount,
      command.chargeback_reason,
      command.chargeback_date ?? null,
      command.chargeback_reference ?? null,
      actor,
    ],
  );

  const refundId = refundRows[0]?.id;

  // Update the original payment status
  await query(
    `UPDATE public.payments
     SET status = CASE
       WHEN $3 >= amount THEN 'REFUNDED'
       ELSE 'PARTIALLY_REFUNDED'
     END,
     refund_amount = COALESCE(refund_amount, 0) + $3,
     updated_at = NOW(), updated_by = $4
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [context.tenantId, payment.id, command.chargeback_amount, actor],
  );

  // Adjust the folio balance if a reservation is linked
  if (payment.reservation_id) {
    await query(
      `UPDATE public.folios
       SET balance = balance + $3,
           total_payments = total_payments - $3,
           updated_at = NOW()
       WHERE tenant_id = $1::uuid AND reservation_id = $2::uuid
         AND folio_status != 'CLOSED'
       LIMIT 1`,
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
