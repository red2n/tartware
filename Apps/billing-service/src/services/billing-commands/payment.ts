import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  type BillingPaymentApplyCommand,
  type BillingPaymentCaptureCommand,
  type BillingPaymentRefundCommand,
  BillingPaymentApplyCommandSchema,
  BillingPaymentAuthorizeCommandSchema,
  BillingPaymentCaptureCommandSchema,
  BillingPaymentRefundCommandSchema,
  BillingPaymentVoidCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  addMoney,
  moneyGt,
  moneyGte,
  parseDbMoney,
  parseDbMoneyOrZero,
  subtractMoney,
} from "../../utils/money.js";
import {
  type CommandContext,
  BillingCommandError,
  SYSTEM_ACTOR_ID,
  asUuid,
  resolveActorId,
  resolveFolioId,
  resolveInvoiceId,
} from "./common.js";

type PaymentRow = {
  id: string;
  amount: number;
  refund_amount: number | null;
  payment_method: string;
  currency: string | null;
  payment_reference: string;
};

/**
 * Capture a payment and record it in billing.
 */
export const captureBillingPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentCaptureCommandSchema.parse(payload);
  return capturePayment(command, context);
};

/**
 * Refund a captured payment and record the refund.
 */
export const refundBillingPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentRefundCommandSchema.parse(payload);
  return refundPayment(command, context);
};

/**
 * Apply a payment to an invoice.
 */
export const applyPayment = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingPaymentApplyCommandSchema.parse(payload);
  return applyPaymentToInvoice(command, context);
};

/**
 * Pre-authorize a payment hold without capturing funds.
 * Records an AUTHORIZED payment that can later be captured or voided.
 */
export const authorizePayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentAuthorizeCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

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
        'AUTHORIZATION',
        UPPER($6)::payment_method,
        $7,
        UPPER($8),
        'AUTHORIZED',
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
        status = 'AUTHORIZED',
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
      "PAYMENT_AUTHORIZE_FAILED",
      "Failed to record payment authorization.",
    );
  }
  return paymentId;
};

/**
 * Void a previously authorized payment.
 * Only AUTHORIZED payments can be voided. Creates a VOID transaction.
 */
export const voidPayment = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingPaymentVoidCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const currency = "USD";

  // Find the authorized payment by reference
  const { rows: authRows } = await query<{ id: string; amount: string; status: string }>(
    `SELECT id, amount, status FROM public.payments
     WHERE tenant_id = $1::uuid AND payment_reference = $2
     ORDER BY created_at DESC LIMIT 1`,
    [context.tenantId, command.payment_reference],
  );
  const authPayment = authRows[0];
  if (!authPayment) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      `No payment found with reference ${command.payment_reference}`,
    );
  }
  if (authPayment.status !== "AUTHORIZED") {
    throw new BillingCommandError(
      "INVALID_PAYMENT_STATUS",
      `Payment is ${authPayment.status}, only AUTHORIZED payments can be voided`,
    );
  }

  const voidId = await withTransaction(async (client) => {
    // Mark original payment as CANCELLED
    await queryWithClient(
      client,
      `UPDATE public.payments SET status = 'CANCELLED', version = version + 1, updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [authPayment.id, context.tenantId],
    );

    // Create a VOID transaction record
    const result = await queryWithClient<{ id: string }>(
      client,
      `INSERT INTO public.payments (
         tenant_id, property_id, reservation_id, guest_id,
         payment_reference, amount, currency,
         transaction_type, status, payment_method,
         notes, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         (SELECT guest_id FROM public.payments WHERE id = $4::uuid),
         $5, $6, $7,
         'VOID', 'COMPLETED', 'CREDIT_CARD',
         $8, $9::uuid, $9::uuid
       ) RETURNING id`,
      [
        context.tenantId,
        command.property_id,
        command.reservation_id,
        authPayment.id,
        `VOID-${command.payment_reference}`,
        parseDbMoneyOrZero(authPayment.amount),
        currency,
        command.reason ?? "Payment voided",
        actorId,
      ],
    );
    return result.rows[0]?.id ?? randomUUID();
  });

  appLogger.info(
    { voidId, originalPaymentId: authPayment.id, reference: command.payment_reference },
    "Payment voided",
  );
  return voidId;
};

const capturePayment = async (
  command: BillingPaymentCaptureCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
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
    throw new BillingCommandError("PAYMENT_CAPTURE_FAILED", "Failed to record captured payment.");
  }

  // G3: Update folio total_payments and balance when reservation_id is present
  if (command.reservation_id) {
    try {
      const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
      if (folioId) {
        await query(
          `
            UPDATE public.folios
            SET
              total_payments = total_payments + $2,
              balance = balance - $2,
              updated_at = NOW(),
              updated_by = $3
            WHERE tenant_id = $1::uuid
              AND folio_id = $4::uuid
          `,
          [context.tenantId, command.amount, actor, folioId],
        );
      }
    } catch {
      // Non-critical — payment recorded; folio balance sync can be reconciled
    }
  }

  return paymentId;
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

  const actor = resolveActorId(context.initiatedBy);
  const originalAmount = parseDbMoney(original.amount);
  if (originalAmount === null) {
    throw new BillingCommandError(
      "PAYMENT_AMOUNT_MISSING",
      "Original payment amount is missing; refund cannot be processed.",
    );
  }
  const previousRefunds = parseDbMoneyOrZero(original.refund_amount);
  const refundTotal = addMoney(previousRefunds, command.amount);

  // Prevent refunds exceeding original payment (using safe money comparison)
  if (moneyGt(refundTotal, originalAmount)) {
    const availableRefund = subtractMoney(originalAmount, previousRefunds);
    throw new BillingCommandError(
      "REFUND_EXCEEDS_PAYMENT",
      `Refund amount ${command.amount} would exceed original payment. Available for refund: ${availableRefund}`,
    );
  }

  const refundStatus = moneyGte(refundTotal, originalAmount) ? "REFUNDED" : "PARTIALLY_REFUNDED";
  const refundTransactionType = moneyGte(command.amount, originalAmount)
    ? "REFUND"
    : "PARTIAL_REFUND";

  const refundReference =
    command.refund_reference ?? `${original.payment_reference}-RF-${Date.now().toString(36)}`;

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
    throw new BillingCommandError("REFUND_RECORD_FAILED", "Failed to record refund payment entry.");
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
    [context.tenantId, original.id, command.amount, refundStatus, command.reason ?? null, actor],
  );

  return refundId;
};

/**
 * Apply a payment to an invoice, updating the invoice balance.
 * Uses atomic dedup via payment metadata to prevent double-counting
 * when the same command is retried (Kafka, network retry, etc.).
 */
const applyPaymentToInvoice = async (
  command: BillingPaymentApplyCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
  const payment = await loadPaymentById(context.tenantId, command.payment_id);
  if (!payment) {
    throw new BillingCommandError("PAYMENT_NOT_FOUND", "Payment not found for apply.");
  }

  const targetInvoiceId =
    command.invoice_id ??
    (await resolveInvoiceId(context.tenantId, command.reservation_id ?? payment.reservation_id));
  if (!targetInvoiceId) {
    throw new BillingCommandError("INVOICE_NOT_FOUND", "Invoice not found for apply.");
  }

  // ── Dedup guard: atomically mark this payment as applied to this invoice ──
  // The WHERE clause ensures this UPDATE only succeeds once per (payment, invoice) pair.
  // If the payment has already been applied to this invoice, rowCount = 0 → return idempotently.
  const { rowCount: markedApplied } = await query(
    `
      UPDATE public.payments
      SET
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{applied_to_invoice_id}',
          to_jsonb($3::text)
        ),
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND (metadata->>'applied_to_invoice_id' IS DISTINCT FROM $3::text)
    `,
    [context.tenantId, command.payment_id, targetInvoiceId, actor],
  );

  if (!markedApplied || markedApplied === 0) {
    // Already applied — return idempotently without modifying invoice balance.
    return targetInvoiceId;
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
    throw new BillingCommandError("INVOICE_NOT_FOUND", "Invoice not found for apply.");
  }
  return invoiceId;
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
