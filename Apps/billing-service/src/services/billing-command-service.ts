import { query } from "../lib/db.js";
import {
  type BillingPaymentCaptureCommand,
  BillingPaymentCaptureCommandSchema,
  type BillingPaymentRefundCommand,
  BillingPaymentRefundCommandSchema,
} from "../schemas/billing-commands.js";

type CommandContext = {
  tenantId: string;
  initiatedBy?: {
    userId?: string;
  } | null;
};

class BillingCommandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const APP_ACTOR = "COMMAND_CENTER";

export const captureBillingPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentCaptureCommandSchema.parse(payload);
  return capturePayment(command, context);
};

export const refundBillingPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentRefundCommandSchema.parse(payload);
  return refundPayment(command, context);
};

const capturePayment = async (
  command: BillingPaymentCaptureCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const currency = command.currency ?? "USD";
  const gatewayResponse = command.gateway?.response ?? {};

  const result = await query<{ id: string }>(
    `
      INSERT INTO public.payments (
        tenant_id,
        property_id,
        reservation_id,
        guest_id,
        payment_reference,
        transaction_type,
        payment_method,
        amount,
        currency,
        status,
        gateway_name,
        gateway_reference,
        gateway_response,
        processed_at,
        processed_by,
        metadata,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5,
        'CAPTURE',
        UPPER($6)::payment_method,
        $7,
        UPPER($8),
        'COMPLETED',
        $9,
        $10,
        $11::jsonb,
        NOW(),
        $12,
        $13::jsonb,
        $12,
        $12
      )
      ON CONFLICT (payment_reference) DO UPDATE
      SET
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        payment_method = EXCLUDED.payment_method,
        status = 'COMPLETED',
        gateway_name = COALESCE(EXCLUDED.gateway_name, payments.gateway_name),
        gateway_reference = COALESCE(EXCLUDED.gateway_reference, payments.gateway_reference),
        gateway_response = payments.gateway_response || EXCLUDED.gateway_response,
        processed_at = NOW(),
        processed_by = EXCLUDED.processed_by,
        metadata = payments.metadata || EXCLUDED.metadata,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id
    `,
    [
      context.tenantId,
      command.property_id,
      command.reservation_id,
      command.guest_id,
      command.payment_reference,
      command.payment_method,
      command.amount,
      currency,
      command.gateway?.name ?? null,
      command.gateway?.reference ?? null,
      JSON.stringify(gatewayResponse),
      actor,
      JSON.stringify(command.metadata ?? {}),
    ],
  );

  const paymentId = result.rows[0]?.id;
  if (!paymentId) {
    throw new BillingCommandError(
      "PAYMENT_CAPTURE_FAILED",
      "Failed to record captured payment.",
    );
  }
  return paymentId;
};

type PaymentRow = {
  id: string;
  amount: number;
  refund_amount: number | null;
  payment_method: string;
  currency: string | null;
  payment_reference: string;
};

const refundPayment = async (
  command: BillingPaymentRefundCommand,
  context: CommandContext,
): Promise<string> => {
  const original = await loadPayment(command, context.tenantId);
  if (!original) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      "Original payment could not be located for refund.",
    );
  }

  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const refundTotal = Number(original.refund_amount ?? 0) + command.amount;
  const refundStatus =
    refundTotal >= Number(original.amount) ? "REFUNDED" : "PARTIALLY_REFUNDED";
  const refundTransactionType =
    command.amount >= Number(original.amount) ? "REFUND" : "PARTIAL_REFUND";

  const refundReference =
    command.refund_reference ??
    `${original.payment_reference}-RF-${Date.now().toString(36)}`;

  const refundResult = await query<{ id: string }>(
    `
      INSERT INTO public.payments (
        tenant_id,
        property_id,
        reservation_id,
        guest_id,
        payment_reference,
        transaction_type,
        payment_method,
        amount,
        currency,
        status,
        processed_at,
        processed_by,
        metadata,
        notes,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5,
        $6::transaction_type,
        UPPER($7)::payment_method,
        $8,
        UPPER($9),
        'COMPLETED',
        NOW(),
        $10,
        $11::jsonb,
        $12,
        $10,
        $10
      )
      RETURNING id
    `,
    [
      context.tenantId,
      command.property_id,
      command.reservation_id,
      command.guest_id,
      refundReference,
      refundTransactionType,
      command.payment_method ?? original.payment_method,
      command.amount,
      command.currency ?? original.currency ?? "USD",
      actor,
      JSON.stringify({ reason: command.reason ?? undefined }),
      command.reason ?? null,
    ],
  );

  const refundId = refundResult.rows[0]?.id;
  if (!refundId) {
    throw new BillingCommandError(
      "REFUND_RECORD_FAILED",
      "Failed to record refund payment entry.",
    );
  }

  await query(
    `
      UPDATE public.payments
      SET
        refund_amount = COALESCE(refund_amount, 0) + $3,
        status = $4::payment_status,
        refund_reason = COALESCE($5, refund_reason),
        refund_date = NOW(),
        refunded_by = $6,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
    `,
    [
      context.tenantId,
      original.id,
      command.amount,
      refundStatus,
      command.reason ?? null,
      actor,
    ],
  );

  return refundId;
};

const loadPayment = async (
  command: BillingPaymentRefundCommand,
  tenantId: string,
): Promise<PaymentRow | undefined> => {
  const { rows } = await query<PaymentRow>(
    `
      SELECT
        id,
        amount,
        refund_amount,
        payment_method,
        currency,
        payment_reference
      FROM public.payments
      WHERE tenant_id = $1::uuid
        AND (
          ($2::uuid IS NOT NULL AND id = $2::uuid)
          OR ($3 IS NOT NULL AND payment_reference = $3)
        )
      LIMIT 1
    `,
    [tenantId, command.payment_id ?? null, command.payment_reference ?? null],
  );

  return rows[0];
};
