import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../lib/db.js";
import {
  type BillingChargePostCommand,
  BillingChargePostCommandSchema,
  type BillingFolioTransferCommand,
  BillingFolioTransferCommandSchema,
  type BillingInvoiceAdjustCommand,
  BillingInvoiceAdjustCommandSchema,
  type BillingInvoiceCreateCommand,
  BillingInvoiceCreateCommandSchema,
  type BillingPaymentApplyCommand,
  BillingPaymentApplyCommandSchema,
  type BillingPaymentCaptureCommand,
  BillingPaymentCaptureCommandSchema,
  type BillingPaymentRefundCommand,
  BillingPaymentRefundCommandSchema,
} from "../schemas/billing-commands.js";
import {
  addMoney,
  moneyGt,
  moneyGte,
  parseDbMoney,
  subtractMoney,
} from "../utils/money.js";

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
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asUuid = (value: string | undefined | null): string | null =>
  value && UUID_REGEX.test(value) ? value : null;

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

export const createInvoice = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingInvoiceCreateCommandSchema.parse(payload);
  return applyInvoiceCreate(command, context);
};

export const adjustInvoice = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingInvoiceAdjustCommandSchema.parse(payload);
  return applyInvoiceAdjust(command, context);
};

export const postCharge = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingChargePostCommandSchema.parse(payload);
  return applyChargePost(command, context);
};

export const applyPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentApplyCommandSchema.parse(payload);
  return applyPaymentToInvoice(command, context);
};

export const transferFolio = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingFolioTransferCommandSchema.parse(payload);
  return applyFolioTransfer(command, context);
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
  const originalAmount = parseDbMoney(original.amount);
  const previousRefunds = parseDbMoney(original.refund_amount);
  const refundTotal = addMoney(previousRefunds, command.amount);

  // Prevent refunds exceeding original payment (using safe money comparison)
  if (moneyGt(refundTotal, originalAmount)) {
    const availableRefund = subtractMoney(originalAmount, previousRefunds);
    throw new BillingCommandError(
      "REFUND_EXCEEDS_PAYMENT",
      `Refund amount ${command.amount} would exceed original payment. Available for refund: ${availableRefund}`,
    );
  }

  const refundStatus = moneyGte(refundTotal, originalAmount)
    ? "REFUNDED"
    : "PARTIALLY_REFUNDED";
  const refundTransactionType = moneyGte(command.amount, originalAmount)
    ? "REFUND"
    : "PARTIAL_REFUND";

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

const applyInvoiceCreate = async (
  command: BillingInvoiceCreateCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const invoiceNumber =
    command.invoice_number ??
    `INV-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const currency = command.currency ?? "USD";

  const result = await query<{ id: string }>(
    `
      INSERT INTO public.invoices (
        tenant_id,
        property_id,
        reservation_id,
        guest_id,
        invoice_number,
        invoice_date,
        due_date,
        subtotal,
        total_amount,
        currency,
        notes,
        status,
        metadata,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5,
        COALESCE($6, CURRENT_DATE),
        $7,
        $8,
        $8,
        UPPER($9),
        $10,
        'DRAFT',
        $11::jsonb,
        $12,
        $12
      )
      RETURNING id
    `,
    [
      context.tenantId,
      command.property_id,
      command.reservation_id,
      command.guest_id,
      invoiceNumber,
      command.invoice_date ?? null,
      command.due_date ?? null,
      command.total_amount,
      currency,
      command.notes ?? null,
      JSON.stringify(command.metadata ?? {}),
      actor,
    ],
  );

  const invoiceId = result.rows[0]?.id;
  if (!invoiceId) {
    throw new BillingCommandError(
      "INVOICE_CREATE_FAILED",
      "Failed to create invoice.",
    );
  }
  return invoiceId;
};

const applyInvoiceAdjust = async (
  command: BillingInvoiceAdjustCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const { rows } = await query<{ id: string }>(
    `
      UPDATE public.invoices
      SET
        total_amount = GREATEST(0, total_amount + $3),
        notes = CASE
          WHEN $4 IS NULL THEN notes
          WHEN notes IS NULL THEN $4
          ELSE CONCAT_WS(E'\\n', notes, $4)
        END,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      RETURNING id
    `,
    [
      context.tenantId,
      command.invoice_id,
      command.adjustment_amount,
      command.reason ?? null,
      actor,
    ],
  );

  const invoiceId = rows[0]?.id;
  if (!invoiceId) {
    throw new BillingCommandError(
      "INVOICE_NOT_FOUND",
      "Invoice not found for adjustment.",
    );
  }
  return invoiceId;
};

const resolveFolioId = async (
  tenantId: string,
  reservationId: string,
): Promise<string | null> => {
  const { rows } = await query<{ folio_id: string }>(
    `
      SELECT folio_id
      FROM public.folios
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, reservationId],
  );
  return rows[0]?.folio_id ?? null;
};

const applyChargePost = async (
  command: BillingChargePostCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const currency = command.currency ?? "USD";
  const folioId = await resolveFolioId(
    context.tenantId,
    command.reservation_id,
  );
  if (!folioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      "No folio found for reservation.",
    );
  }

  const result = await query<{ posting_id: string }>(
    `
      INSERT INTO public.charge_postings (
        tenant_id,
        property_id,
        folio_id,
        reservation_id,
        transaction_type,
        posting_type,
        charge_code,
        charge_description,
        quantity,
        unit_price,
        subtotal,
        total_amount,
        currency_code,
        posting_time,
        business_date,
        notes,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        'CHARGE',
        'DEBIT',
        'MISC',
        $5,
        1,
        $6,
        $6,
        $6,
        UPPER($7),
        NOW(),
        CURRENT_DATE,
        $8,
        $9::uuid,
        $9::uuid
      )
      RETURNING posting_id
    `,
    [
      context.tenantId,
      command.property_id,
      folioId,
      command.reservation_id,
      command.description ?? "Charge",
      command.amount,
      currency,
      command.description ?? null,
      actorId,
    ],
  );

  const postingId = result.rows[0]?.posting_id;
  if (!postingId) {
    throw new BillingCommandError(
      "CHARGE_POST_FAILED",
      "Unable to post charge.",
    );
  }
  return postingId;
};

const loadPaymentById = async (
  tenantId: string,
  paymentId: string,
): Promise<{ amount: number; reservation_id: string | null } | null> => {
  const { rows } = await query<{
    amount: number;
    reservation_id: string | null;
  }>(
    `
      SELECT amount, reservation_id
      FROM public.payments
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      LIMIT 1
    `,
    [tenantId, paymentId],
  );
  return rows[0] ?? null;
};

const applyPaymentToInvoice = async (
  command: BillingPaymentApplyCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const payment = await loadPaymentById(context.tenantId, command.payment_id);
  if (!payment) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      "Payment not found for apply.",
    );
  }

  const targetInvoiceId =
    command.invoice_id ??
    (await resolveInvoiceId(
      context.tenantId,
      command.reservation_id ?? payment.reservation_id,
    ));
  if (!targetInvoiceId) {
    throw new BillingCommandError(
      "INVOICE_NOT_FOUND",
      "Invoice not found for apply.",
    );
  }

  const applyAmount = command.amount ?? payment.amount;
  const { rows } = await query<{
    id: string;
    total_amount: number;
    paid_amount: number;
  }>(
    `
      UPDATE public.invoices
      SET
        paid_amount = COALESCE(paid_amount, 0) + $3,
        status = CASE
          WHEN COALESCE(paid_amount, 0) + $3 >= total_amount THEN 'PAID'
          ELSE 'PARTIALLY_PAID'
        END,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      RETURNING id, total_amount, paid_amount
    `,
    [context.tenantId, targetInvoiceId, applyAmount, actor],
  );

  const invoiceId = rows[0]?.id;
  if (!invoiceId) {
    throw new BillingCommandError(
      "INVOICE_NOT_FOUND",
      "Invoice not found for apply.",
    );
  }
  return invoiceId;
};

const resolveInvoiceId = async (
  tenantId: string,
  reservationId: string | null | undefined,
): Promise<string | null> => {
  if (!reservationId) {
    return null;
  }
  const { rows } = await query<{ id: string }>(
    `
      SELECT id
      FROM public.invoices
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, reservationId],
  );
  return rows[0]?.id ?? null;
};

const applyFolioTransfer = async (
  command: BillingFolioTransferCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const fromFolioId = await resolveFolioId(
    context.tenantId,
    command.from_reservation_id,
  );
  const toFolioId = await resolveFolioId(
    context.tenantId,
    command.to_reservation_id,
  );
  if (!fromFolioId || !toFolioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      "Unable to locate folios for transfer.",
    );
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
