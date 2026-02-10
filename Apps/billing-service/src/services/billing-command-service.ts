import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  type BillingChargePostCommand,
  BillingChargePostCommandSchema,
  type BillingChargeVoidCommand,
  BillingChargeVoidCommandSchema,
  BillingFolioCloseCommandSchema,
  type BillingFolioTransferCommand,
  BillingFolioTransferCommandSchema,
  type BillingInvoiceAdjustCommand,
  BillingInvoiceAdjustCommandSchema,
  type BillingInvoiceCreateCommand,
  BillingInvoiceCreateCommandSchema,
  BillingInvoiceFinalizeCommandSchema,
  BillingNightAuditCommandSchema,
  type BillingPaymentApplyCommand,
  BillingPaymentApplyCommandSchema,
  BillingPaymentAuthorizeCommandSchema,
  type BillingPaymentCaptureCommand,
  BillingPaymentCaptureCommandSchema,
  type BillingPaymentRefundCommand,
  BillingPaymentRefundCommandSchema,
  BillingPaymentVoidCommandSchema,
  CommissionCalculateCommandSchema,
  CommissionApproveCommandSchema,
  CommissionMarkPaidCommandSchema,
  CommissionStatementGenerateCommandSchema,
  BillingChargeTransferCommandSchema,
  BillingFolioSplitCommandSchema,
  BillingArPostCommandSchema,
  BillingArApplyPaymentCommandSchema,
  BillingArAgeCommandSchema,
  BillingArWriteOffCommandSchema,
} from "../schemas/billing-commands.js";
import {
  addMoney,
  moneyGt,
  moneyGte,
  parseDbMoney,
  parseDbMoneyOrZero,
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
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const asUuid = (value: string | undefined | null): string | null =>
  value && UUID_REGEX.test(value) ? value : null;

const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  initiatedBy?.userId ?? APP_ACTOR;

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
 * Create a billing invoice.
 */
export const createInvoice = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingInvoiceCreateCommandSchema.parse(payload);
  return applyInvoiceCreate(command, context);
};

/**
 * Adjust an invoice total with a positive or negative delta.
 */
export const adjustInvoice = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingInvoiceAdjustCommandSchema.parse(payload);
  return applyInvoiceAdjust(command, context);
};

/**
 * Post a miscellaneous charge to a reservation folio.
 */
export const postCharge = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingChargePostCommandSchema.parse(payload);
  return applyChargePost(command, context);
};

/**
 * Apply a payment to an invoice.
 */
export const applyPayment = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingPaymentApplyCommandSchema.parse(payload);
  return applyPaymentToInvoice(command, context);
};

/**
 * Transfer folio balance between reservations.
 */
export const transferFolio = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioTransferCommandSchema.parse(payload);
  return applyFolioTransfer(command, context);
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

const applyInvoiceCreate = async (
  command: BillingInvoiceCreateCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
  const invoiceNumber =
    command.invoice_number ?? `INV-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
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
    throw new BillingCommandError("INVOICE_CREATE_FAILED", "Failed to create invoice.");
  }
  return invoiceId;
};

const applyInvoiceAdjust = async (
  command: BillingInvoiceAdjustCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
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
    throw new BillingCommandError("INVOICE_NOT_FOUND", "Invoice not found for adjustment.");
  }
  return invoiceId;
};

const resolveFolioId = async (tenantId: string, reservationId: string): Promise<string | null> => {
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
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const currency = command.currency ?? "USD";
  const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  if (!folioId) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "No folio found for reservation.");
  }

  const postingId = await withTransaction(async (client) => {
    const unitPrice = command.amount;
    const subtotal = unitPrice * command.quantity;
    const result = await queryWithClient<{ posting_id: string }>(
      client,
      `
        INSERT INTO public.charge_postings (
          tenant_id,
          property_id,
          folio_id,
          reservation_id,
          transaction_type,
          posting_type,
          charge_code,
          department_code,
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
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $11,
          UPPER($12),
          COALESCE($13::timestamptz, NOW()),
          CURRENT_DATE,
          $14,
          $15::uuid,
          $15::uuid
        )
        RETURNING posting_id
      `,
      [
        context.tenantId,
        command.property_id,
        folioId,
        command.reservation_id,
        command.posting_type,
        command.charge_code,
        command.department_code ?? null,
        command.description ?? "Charge",
        command.quantity,
        unitPrice,
        subtotal,
        currency,
        command.posted_at ?? null,
        command.description ?? null,
        actorId,
      ],
    );

    const id = result.rows[0]?.posting_id;
    if (!id) {
      throw new BillingCommandError("CHARGE_POST_FAILED", "Unable to post charge.");
    }

    // G3: Update folio totals — must satisfy CHECK (balance = total_charges - total_payments - total_credits)
    await queryWithClient(
      client,
      `
        UPDATE public.folios
        SET
          total_charges = total_charges + $2,
          balance = balance + $2,
          updated_at = NOW(),
          updated_by = $3::uuid
        WHERE tenant_id = $1::uuid
          AND folio_id = $4::uuid
      `,
      [context.tenantId, command.amount, actorId, folioId],
    );

    return id;
  });

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
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const fromFolioId = await resolveFolioId(context.tenantId, command.from_reservation_id);
  const toFolioId = await resolveFolioId(context.tenantId, command.to_reservation_id);
  if (!fromFolioId || !toFolioId) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "Unable to locate folios for transfer.");
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
 * Void a charge posting. Within a single transaction:
 * 1. Validates the original posting exists and is not already voided.
 * 2. Marks the original posting as voided.
 * 3. Inserts a reversal VOID posting (CREDIT) for the same amount.
 * 4. Cross-links original ↔ void via void_posting_id / original_posting_id.
 * 5. Adjusts folio balance to reverse the charge.
 */
const applyChargeVoid = async (
  command: BillingChargeVoidCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;

  return withTransaction(async (client) => {
    const { rows: postingRows } = await queryWithClient<{
      posting_id: string;
      tenant_id: string;
      property_id: string;
      folio_id: string;
      reservation_id: string | null;
      guest_id: string | null;
      charge_code: string;
      charge_description: string;
      charge_category: string | null;
      quantity: string;
      unit_price: string;
      subtotal: string;
      tax_amount: string;
      service_charge: string;
      discount_amount: string;
      total_amount: string;
      currency_code: string;
      department_code: string | null;
      revenue_center: string | null;
      gl_account: string | null;
      is_voided: boolean;
    }>(
      client,
      `SELECT posting_id, tenant_id, property_id, folio_id, reservation_id,
              guest_id, charge_code, charge_description, charge_category,
              quantity, unit_price, subtotal, tax_amount, service_charge,
              discount_amount, total_amount, currency_code, department_code,
              revenue_center, gl_account, is_voided
       FROM public.charge_postings
       WHERE posting_id = $1::uuid
         AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.posting_id, context.tenantId],
    );

    const original = postingRows[0];
    if (!original) {
      throw new BillingCommandError(
        "POSTING_NOT_FOUND",
        `Charge posting ${command.posting_id} not found.`,
      );
    }
    if (original.is_voided) {
      throw new BillingCommandError(
        "POSTING_ALREADY_VOIDED",
        `Charge posting ${command.posting_id} has already been voided.`,
      );
    }

    await queryWithClient(
      client,
      `UPDATE public.charge_postings
       SET is_voided = TRUE,
           voided_at = NOW(),
           voided_by = $3::uuid,
           void_reason = $4,
           version = version + 1,
           updated_at = NOW(),
           updated_by = $3::uuid
       WHERE posting_id = $1::uuid
         AND tenant_id = $2::uuid`,
      [command.posting_id, context.tenantId, actorId, command.void_reason ?? null],
    );

    const voidResult = await queryWithClient<{ posting_id: string }>(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id, guest_id,
         transaction_type, posting_type, charge_code, charge_description,
         charge_category, quantity, unit_price, subtotal,
         tax_amount, service_charge, discount_amount, total_amount,
         currency_code, department_code, revenue_center, gl_account,
         original_posting_id, business_date, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
         'VOID', 'CREDIT', $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20::uuid, CURRENT_DATE, $21,
         $22::uuid, $22::uuid
       )
       RETURNING posting_id`,
      [
        context.tenantId,
        original.property_id,
        original.folio_id,
        original.reservation_id,
        original.guest_id,
        original.charge_code,
        `VOID: ${original.charge_description}`,
        original.charge_category,
        original.quantity,
        original.unit_price,
        original.subtotal,
        original.tax_amount,
        original.service_charge,
        original.discount_amount,
        original.total_amount,
        original.currency_code,
        original.department_code,
        original.revenue_center,
        original.gl_account,
        command.posting_id,
        command.void_reason ?? `Void of posting ${command.posting_id}`,
        actorId,
      ],
    );

    const voidPostingId = voidResult.rows[0]?.posting_id;
    if (!voidPostingId) {
      throw new BillingCommandError("CHARGE_VOID_FAILED", "Failed to create void posting.");
    }

    await queryWithClient(
      client,
      `UPDATE public.charge_postings
       SET void_posting_id = $3::uuid,
           version = version + 1,
           updated_at = NOW(),
           updated_by = $4::uuid
       WHERE posting_id = $1::uuid
         AND tenant_id = $2::uuid`,
      [command.posting_id, context.tenantId, voidPostingId, actorId],
    );

    const totalAmount = parseDbMoneyOrZero(original.total_amount);
    await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_charges = total_charges - $2,
           balance = balance - $2,
           updated_at = NOW(),
           updated_by = $3::uuid
       WHERE tenant_id = $1::uuid
         AND folio_id = $4::uuid`,
      [context.tenantId, totalAmount, actorId, original.folio_id],
    );

    appLogger.info(
      { voidPostingId, originalPostingId: command.posting_id, totalAmount },
      "Charge posting voided",
    );

    return voidPostingId;
  });
};

/**
 * Void a charge posting and create a reversal entry.
 * Adjusts folio balance to reverse the original charge.
 */
export const voidCharge = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingChargeVoidCommandSchema.parse(payload);
  return applyChargeVoid(command, context);
};

/**
 * Finalize an invoice. Transitions status from DRAFT or SENT to FINALIZED,
 * locking the invoice from further edits or adjustments.
 */
const applyInvoiceFinalize = async (
  command: { invoice_id: string; metadata?: Record<string, unknown> },
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);

  const { rows } = await query<{ id: string; status: string }>(
    `SELECT id, status FROM public.invoices
     WHERE tenant_id = $1::uuid AND id = $2::uuid
     LIMIT 1`,
    [context.tenantId, command.invoice_id],
  );

  const invoice = rows[0];
  if (!invoice) {
    throw new BillingCommandError("INVOICE_NOT_FOUND", "Invoice not found for finalization.");
  }

  if (invoice.status !== "DRAFT" && invoice.status !== "SENT") {
    throw new BillingCommandError(
      "INVALID_INVOICE_STATUS",
      `Invoice is ${invoice.status}; only DRAFT or SENT invoices can be finalized.`,
    );
  }

  await query(
    `UPDATE public.invoices
     SET status = 'FINALIZED',
         updated_at = NOW(),
         updated_by = $3
     WHERE tenant_id = $1::uuid
       AND id = $2::uuid`,
    [context.tenantId, command.invoice_id, actor],
  );

  appLogger.info(
    { invoiceId: command.invoice_id, previousStatus: invoice.status },
    "Invoice finalized",
  );

  return command.invoice_id;
};

/**
 * Finalize an invoice, locking it from further edits.
 * Only DRAFT or SENT invoices can be finalized.
 */
export const finalizeInvoice = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingInvoiceFinalizeCommandSchema.parse(payload);
  return applyInvoiceFinalize(command, context);
};

/**
 * Execute the nightly audit process:
 * 1. Post room+tax charges for all CHECKED_IN reservations
 * 2. Mark stale PENDING/CONFIRMED reservations as NO_SHOW
 * 3. Advance the business date
 */
export const executeNightAudit = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingNightAuditCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const shouldPostCharges = command.post_room_charges !== false;
  const shouldMarkNoShows = command.mark_no_shows !== false;
  const shouldAdvanceDate = command.advance_date !== false;

  // Resolve current business date
  const bizDateResult = await query<{ business_date: string }>(
    `SELECT business_date::text AS business_date FROM public.business_dates
     WHERE property_id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.property_id, context.tenantId],
  );
  const businessDate = command.business_date ?? bizDateResult.rows[0]?.business_date;
  const auditDate = businessDate ?? new Date().toISOString().slice(0, 10);

  let chargesPosted = 0;
  let noShowsMarked = 0;
  let taxChargesPosted = 0;

  // Step 1: Post room charges for in-house guests
  if (shouldPostCharges) {
    const inHouseResult = await query<{
      id: string;
      room_rate: string;
      room_number: string;
      total_amount: string;
      guest_id: string;
    }>(
      `SELECT r.id, r.room_rate, r.room_number, r.total_amount, r.guest_id
       FROM reservations r
       WHERE r.tenant_id = $1 AND r.property_id = $2 AND r.status = 'CHECKED_IN'
         AND r.is_deleted = false`,
      [context.tenantId, command.property_id],
    );

    for (const res of inHouseResult.rows) {
      const roomRate = Number(res.room_rate ?? 0);
      if (roomRate <= 0) continue;

      const folioId = await resolveFolioId(context.tenantId, res.id);
      if (!folioId) continue;

      try {
        await withTransaction(async (client) => {
          // Post room charge
          await queryWithClient(
            client,
            `INSERT INTO public.charge_postings (
               tenant_id, property_id, folio_id, reservation_id,
               transaction_type, posting_type, charge_code, charge_description,
               quantity, unit_price, subtotal, total_amount,
               currency_code, posting_time, business_date,
               notes, created_by, updated_by
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid, $4::uuid,
               'CHARGE', 'DEBIT', 'ROOM', 'Room charge - night audit',
               1, $5, $5, $5,
               'USD', NOW(), $6::date,
               'Auto-posted by night audit', $7::uuid, $7::uuid
             )`,
            [context.tenantId, command.property_id, folioId, res.id, roomRate, auditDate, actorId],
          );

          // G7: Calculate and post applicable taxes for room charge
          const taxResult = await queryWithClient<{
            tax_code: string;
            tax_name: string;
            tax_rate: string;
          }>(
            client,
            `SELECT tax_code, tax_name, tax_rate FROM tax_configurations
             WHERE tenant_id = $1::uuid
               AND (property_id = $2::uuid OR property_id IS NULL)
               AND is_active = TRUE
               AND effective_from <= $3::date
               AND (effective_to IS NULL OR effective_to >= $3::date)
               AND 'rooms' = ANY(applies_to)
               AND is_percentage = TRUE
             ORDER BY tax_code`,
            [context.tenantId, command.property_id, auditDate],
          );

          let totalTaxAmount = 0;
          for (const tax of taxResult.rows) {
            const taxRate = Number(tax.tax_rate);
            const taxAmount = Number(((roomRate * taxRate) / 100).toFixed(2));
            if (taxAmount <= 0) continue;

            await queryWithClient(
              client,
              `INSERT INTO public.charge_postings (
                 tenant_id, property_id, folio_id, reservation_id,
                 transaction_type, posting_type, charge_code, charge_description,
                 quantity, unit_price, subtotal, total_amount,
                 currency_code, posting_time, business_date,
                 department_code, notes, created_by, updated_by
               ) VALUES (
                 $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                 'CHARGE', 'DEBIT', 'ROOM_TAX', $5,
                 1, $6, $6, $6,
                 'USD', NOW(), $7::date,
                 'ROOMS', $8, $9::uuid, $9::uuid
               )`,
              [
                context.tenantId,
                command.property_id,
                folioId,
                res.id,
                `${tax.tax_name} (${taxRate}%)`,
                taxAmount,
                auditDate,
                `${tax.tax_code}: ${taxRate}% on room charge`,
                actorId,
              ],
            );
            totalTaxAmount += taxAmount;
            taxChargesPosted++;
          }

          // Update folio balance (room charge + taxes)
          const chargeTotal = roomRate + totalTaxAmount;
          await queryWithClient(
            client,
            `UPDATE public.folios
             SET total_charges = total_charges + $2,
                 balance = balance + $2,
                 updated_at = NOW(), updated_by = $3::uuid
             WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
            [context.tenantId, chargeTotal, actorId, folioId],
          );
        });
        chargesPosted++;
      } catch {
        // Log but continue with other reservations
      }
    }
  }

  // Step 2: Mark no-shows (PENDING/CONFIRMED with check_in_date <= business date)
  if (shouldMarkNoShows) {
    const noShowResult = await query<{ count: string }>(
      `UPDATE reservations
       SET status = 'NO_SHOW', is_no_show = true,
           no_show_date = NOW(), no_show_fee = COALESCE(room_rate, 0),
           version = version + 1, updated_at = NOW()
       WHERE tenant_id = $1 AND property_id = $2
         AND status IN ('PENDING', 'CONFIRMED')
         AND check_in_date <= $3::date
         AND is_deleted = false
       RETURNING id`,
      [context.tenantId, command.property_id, auditDate],
    );
    noShowsMarked = noShowResult.rowCount ?? 0;
  }

  // Step 3: Advance business date
  if (shouldAdvanceDate) {
    await query(
      `UPDATE public.business_dates
       SET business_date = ($3::date + INTERVAL '1 day')::date,
           previous_business_date = $3::date,
           updated_at = NOW(), updated_by = $4
       WHERE property_id = $1 AND tenant_id = $2`,
      [command.property_id, context.tenantId, auditDate, actorId],
    );
  }

  // Log audit run in night_audit_log
  const auditRunId = randomUUID();
  const auditLogResult = await query<{ audit_log_id: string }>(
    `INSERT INTO public.night_audit_log (
       tenant_id, property_id, audit_run_id, business_date,
       audit_status, step_number, step_name, step_category, step_status,
       started_at, completed_at, step_completed_at,
       records_processed, records_succeeded,
       initiated_by, created_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::date,
       'COMPLETED', 1, 'night_audit_full', 'AUDIT', 'COMPLETED',
       NOW(), NOW(), NOW(),
       $5, $5,
       $6::uuid, $6::uuid
     )
     ON CONFLICT DO NOTHING
     RETURNING audit_log_id`,
    [
      context.tenantId,
      command.property_id,
      auditRunId,
      auditDate,
      chargesPosted + noShowsMarked,
      actorId,
    ],
  );

  appLogger.info(
    { auditDate, chargesPosted, noShowsMarked, taxChargesPosted, auditRunId },
    "Night audit completed",
  );

  return auditLogResult.rows[0]?.audit_log_id ?? `audit-${auditDate}`;
};

/**
 * Close/settle a folio. Sets folio_status to SETTLED (if balance=0)
 * or CLOSED (if balance > 0 and force=true). Blocks if balance > 0
 * without force.
 */
export const closeFolio = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioCloseCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;

  const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  if (!folioId) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "No folio found for reservation.");
  }

  // Check current folio state
  const { rows } = await query<{ folio_status: string; balance: string }>(
    `SELECT folio_status, balance FROM public.folios
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid LIMIT 1`,
    [context.tenantId, folioId],
  );
  const folio = rows[0];
  if (!folio) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "Folio record not found.");
  }
  if (folio.folio_status === "CLOSED" || folio.folio_status === "SETTLED") {
    appLogger.info({ folioId, status: folio.folio_status }, "Folio already closed/settled");
    return folioId;
  }

  const balance = parseDbMoneyOrZero(folio.balance);
  if (balance > 0 && !command.force) {
    throw new BillingCommandError(
      "FOLIO_UNSETTLED",
      `Folio has outstanding balance of ${balance.toFixed(2)}. Use force:true to close anyway.`,
    );
  }

  const newStatus = balance === 0 ? "SETTLED" : "CLOSED";
  const settledAt = newStatus === "SETTLED" ? new Date() : null;
  const settledBy = newStatus === "SETTLED" ? actorId : null;
  await query(
    `UPDATE public.folios
     SET folio_status = $3::text, closed_at = NOW(), close_reason = $4,
         settled_at = $6::timestamptz, settled_by = $7::uuid,
         updated_at = NOW(), updated_by = $5::uuid
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
    [
      context.tenantId,
      folioId,
      newStatus,
      command.close_reason ?? null,
      actorId,
      settledAt,
      settledBy,
    ],
  );

  appLogger.info(
    { folioId, newStatus, balance, reservationId: command.reservation_id },
    "Folio closed/settled",
  );
  return folioId;
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

// ─── Commission Handlers ─────────────────────────────────────────────────────

/**
 * Calculate commission for a reservation.
 * Looks up applicable commission rules from booking_sources or commission_rules,
 * then inserts into travel_agent_commissions and commission_tracking.
 */
export const calculateCommission = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = CommissionCalculateCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  // Determine commission config: prefer travel_agent_id → booking_sources fallback
  let commissionType = "PERCENTAGE";
  let commissionRate = 0;
  let flatAmount = 0;
  let agentCompanyId: string | null = null;

  if (command.travel_agent_id) {
    // Look up applicable commission rule for this agent
    const ruleResult = await query<{
      commission_type: string;
      default_rate: number;
      room_rate: number;
      flat_amount: number;
      company_id: string | null;
    }>(
      `SELECT cr.commission_type, cr.default_rate, cr.room_rate,
              COALESCE(cr.flat_amount_per_booking, 0) AS flat_amount,
              cr.company_id
       FROM commission_rules cr
       WHERE cr.tenant_id = $1
         AND cr.is_active = true
         AND (cr.company_id = (SELECT company_id FROM travel_agents WHERE agent_id = $2 AND tenant_id = $1 LIMIT 1)
              OR cr.apply_to_all_agents = true)
         AND (cr.effective_start IS NULL OR cr.effective_start <= CURRENT_DATE)
         AND (cr.effective_end IS NULL OR cr.effective_end >= CURRENT_DATE)
       ORDER BY cr.apply_to_all_agents ASC, cr.priority DESC
       LIMIT 1`,
      [tenantId, command.travel_agent_id],
    );
    const rule = ruleResult.rows?.[0];
    if (rule) {
      commissionType = rule.commission_type;
      commissionRate = Number(rule.room_rate || rule.default_rate || 0);
      flatAmount = Number(rule.flat_amount || 0);
      agentCompanyId = rule.company_id;
    }
  }

  if (commissionRate === 0 && flatAmount === 0 && command.booking_source_id) {
    // Fallback: look up booking_sources commission config
    const srcResult = await query<{
      commission_type: string;
      commission_percentage: number;
      commission_fixed_amount: number;
    }>(
      `SELECT commission_type, COALESCE(commission_percentage, 0) AS commission_percentage,
              COALESCE(commission_fixed_amount, 0) AS commission_fixed_amount
       FROM booking_sources
       WHERE source_id = $1 AND tenant_id = $2 LIMIT 1`,
      [command.booking_source_id, tenantId],
    );
    const src = srcResult.rows?.[0];
    if (src && src.commission_type !== "NONE") {
      commissionType = src.commission_type;
      commissionRate = Number(src.commission_percentage);
      flatAmount = Number(src.commission_fixed_amount);
    }
  }

  // Calculate gross commission
  let grossCommission = 0;
  if (commissionType === "PERCENTAGE" && commissionRate > 0) {
    grossCommission = (command.room_revenue * commissionRate) / 100;
  } else if (commissionType === "FIXED" || commissionType === "FLAT_RATE") {
    grossCommission = flatAmount;
  } else if (commissionRate > 0) {
    // Default to percentage
    grossCommission = (command.room_revenue * commissionRate) / 100;
  }

  if (grossCommission <= 0) {
    appLogger.debug(
      { reservationId: command.reservation_id },
      "No commission applicable — skipping",
    );
    return "NO_COMMISSION";
  }

  // Round to 2 decimal places
  grossCommission = Math.round(grossCommission * 100) / 100;

  const commissionId = randomUUID();
  const trackingId = randomUUID();

  await withTransaction(async (client) => {
    // Insert into travel_agent_commissions
    await queryWithClient(
      client,
      `INSERT INTO travel_agent_commissions (
         commission_id, tenant_id, property_id, reservation_id,
         agent_id, company_id, commission_type, room_revenue,
         room_commission_rate, gross_commission_amount,
         currency_code, payment_status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5::uuid, $6::uuid, $7, $8,
         $9, $10,
         $11, 'PENDING',
         $12::uuid, $12::uuid
       )`,
      [
        commissionId,
        tenantId,
        command.property_id,
        command.reservation_id,
        command.travel_agent_id ?? null,
        agentCompanyId,
        commissionType.toLowerCase(),
        command.room_revenue,
        commissionRate,
        grossCommission,
        command.currency,
        actorId,
      ],
    );

    // Insert into commission_tracking
    await queryWithClient(
      client,
      `INSERT INTO commission_tracking (
         tracking_id, tenant_id, property_id, reservation_id,
         commission_type, beneficiary_type, beneficiary_id,
         base_amount, commission_rate, calculated_amount,
         final_amount, currency_code, status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'booking', 'agent', $5::uuid,
         $6, $7, $8,
         $8, $9, 'pending',
         $10::uuid, $10::uuid
       )`,
      [
        trackingId,
        tenantId,
        command.property_id,
        command.reservation_id,
        command.travel_agent_id ?? command.booking_source_id ?? null,
        command.room_revenue,
        commissionRate,
        grossCommission,
        command.currency,
        actorId,
      ],
    );
  });

  appLogger.info(
    {
      commissionId,
      trackingId,
      reservationId: command.reservation_id,
      grossCommission,
      commissionRate,
      commissionType,
    },
    "Commission calculated and recorded",
  );

  return commissionId;
};

/**
 * Approve a pending commission for payout.
 */
export const approveCommission = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = CommissionApproveCommandSchema.parse(payload);
  const tenantId = context.tenantId;

  const result = await query(
    `UPDATE travel_agent_commissions
     SET payment_status = 'APPROVED',
         approved_at = NOW(),
         approved_by = $3::uuid,
         approval_notes = $4,
         updated_by = $3::uuid,
         updated_at = NOW()
     WHERE commission_id = $1 AND tenant_id = $2 AND payment_status = 'PENDING'`,
    [command.commission_id, tenantId, command.approved_by, command.notes ?? null],
  );

  if (result.rowCount === 0) {
    throw new BillingCommandError(
      "COMMISSION_NOT_FOUND",
      `Commission ${command.commission_id} not found or not in PENDING status`,
    );
  }

  // Also update commission_tracking
  await query(
    `UPDATE commission_tracking
     SET status = 'approved', approved_at = NOW(), approved_by = $3::uuid, updated_at = NOW()
     WHERE reservation_id = (
       SELECT reservation_id FROM travel_agent_commissions WHERE commission_id = $1 AND tenant_id = $2
     ) AND tenant_id = $2 AND status = 'pending'`,
    [command.commission_id, tenantId, command.approved_by],
  );

  appLogger.info({ commissionId: command.commission_id }, "Commission approved");
  return command.commission_id;
};

/**
 * Mark a commission as paid.
 */
export const markCommissionPaid = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = CommissionMarkPaidCommandSchema.parse(payload);
  const tenantId = context.tenantId;

  const result = await query(
    `UPDATE travel_agent_commissions
     SET payment_status = 'PAID',
         payment_date = COALESCE($3::timestamptz, NOW()),
         payment_reference = $4,
         payment_method = $5,
         updated_at = NOW()
     WHERE commission_id = $1 AND tenant_id = $2 AND payment_status IN ('PENDING', 'APPROVED')`,
    [
      command.commission_id,
      tenantId,
      command.payment_date ?? null,
      command.payment_reference,
      command.payment_method ?? null,
    ],
  );

  if (result.rowCount === 0) {
    throw new BillingCommandError(
      "COMMISSION_NOT_FOUND",
      `Commission ${command.commission_id} not found or already paid`,
    );
  }

  // Update commission_tracking
  await query(
    `UPDATE commission_tracking
     SET status = 'paid', paid_at = NOW(), payment_reference = $3, updated_at = NOW()
     WHERE reservation_id = (
       SELECT reservation_id FROM travel_agent_commissions WHERE commission_id = $1 AND tenant_id = $2
     ) AND tenant_id = $2 AND status IN ('pending', 'approved')`,
    [command.commission_id, tenantId, command.payment_reference],
  );

  appLogger.info(
    { commissionId: command.commission_id, paymentRef: command.payment_reference },
    "Commission marked as paid",
  );
  return command.commission_id;
};

/**
 * Generate a periodic commission statement for an agent/company.
 */
export const generateCommissionStatement = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = CommissionStatementGenerateCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  // Aggregate commissions for the period
  const agentFilter = command.agent_id
    ? ` AND tac.agent_id = '${command.agent_id}'`
    : command.company_id
      ? ` AND tac.company_id = '${command.company_id}'`
      : "";

  const statsResult = await query<{
    total_bookings: number;
    total_room_nights: number;
    total_revenue: number;
    total_gross: number;
    company_id: string | null;
    agent_id: string | null;
  }>(
    `SELECT
       COUNT(DISTINCT tac.reservation_id) AS total_bookings,
       COALESCE(SUM(r.nights), 0) AS total_room_nights,
       COALESCE(SUM(tac.room_revenue), 0) AS total_revenue,
       COALESCE(SUM(tac.gross_commission_amount), 0) AS total_gross,
       tac.company_id, tac.agent_id
     FROM travel_agent_commissions tac
     LEFT JOIN reservations r ON r.id = tac.reservation_id AND r.tenant_id = tac.tenant_id
     WHERE tac.tenant_id = $1
       AND tac.property_id = $2
       AND tac.created_at >= $3
       AND tac.created_at < $4
       ${agentFilter}
     GROUP BY tac.company_id, tac.agent_id`,
    [tenantId, command.property_id, command.period_start, command.period_end],
  );

  if (statsResult.rows.length === 0) {
    appLogger.info(
      { propertyId: command.property_id, periodStart: command.period_start, periodEnd: command.period_end },
      "No commissions found for statement period",
    );
    return "NO_COMMISSIONS";
  }

  const statementsCreated: string[] = [];

  for (const stats of statsResult.rows) {
    const statementId = randomUUID();
    const statementNumber = `CS-${new Date().getFullYear()}-${statementId.slice(0, 8).toUpperCase()}`;

    await query(
      `INSERT INTO commission_statements (
         statement_id, tenant_id, property_id, company_id, agent_id,
         statement_number, statement_date, period_start, period_end,
         total_bookings, total_room_nights, total_revenue,
         gross_commission, net_commission,
         currency_code, statement_status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
         $6, CURRENT_DATE, $7, $8,
         $9, $10, $11, $12, $12,
         $13, 'DRAFT',
         $14::uuid, $14::uuid
       )`,
      [
        statementId,
        tenantId,
        command.property_id,
        stats.company_id,
        stats.agent_id,
        statementNumber,
        command.period_start,
        command.period_end,
        stats.total_bookings,
        stats.total_room_nights,
        stats.total_revenue,
        stats.total_gross,
        command.metadata?.currency ?? "USD",
        actorId,
      ],
    );
    statementsCreated.push(statementId);
  }

  appLogger.info(
    {
      count: statementsCreated.length,
      propertyId: command.property_id,
      periodStart: command.period_start,
      periodEnd: command.period_end,
    },
    "Commission statements generated",
  );
  return statementsCreated[0] ?? "NO_STATEMENTS";
};

// ─── Split Billing / Charge Transfer Handlers ────────────────────────────────

/**
 * Transfer a specific charge posting from one folio to another.
 * Creates TRANSFER-type audit records on both folios and adjusts balances.
 */
export const transferCharge = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingChargeTransferCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  // Resolve target folio
  let targetFolioId = command.to_folio_id ?? null;
  if (!targetFolioId && command.to_reservation_id) {
    targetFolioId = await resolveFolioId(tenantId, command.to_reservation_id);
  }
  if (!targetFolioId) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "Unable to locate target folio for charge transfer.");
  }

  return withTransaction(async (client) => {
    // 1. Fetch and lock the original posting
    const { rows } = await queryWithClient<{
      posting_id: string;
      folio_id: string;
      property_id: string;
      reservation_id: string | null;
      charge_code: string;
      charge_description: string;
      quantity: string;
      unit_price: string;
      subtotal: string;
      total_amount: string;
      currency_code: string;
      department_code: string | null;
      is_voided: boolean;
    }>(
      client,
      `SELECT posting_id, folio_id, property_id, reservation_id,
              charge_code, charge_description, quantity, unit_price,
              subtotal, total_amount, currency_code, department_code, is_voided
       FROM charge_postings
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.posting_id, tenantId],
    );

    const original = rows[0];
    if (!original) {
      throw new BillingCommandError("POSTING_NOT_FOUND", `Posting ${command.posting_id} not found.`);
    }
    if (original.is_voided) {
      throw new BillingCommandError("POSTING_VOIDED", "Cannot transfer a voided posting.");
    }
    if (original.folio_id === targetFolioId) {
      throw new BillingCommandError("SAME_FOLIO", "Source and target folio are the same.");
    }

    const amount = parseDbMoneyOrZero(original.total_amount);

    // 2. Mark original as transferred
    await queryWithClient(client,
      `UPDATE charge_postings
       SET transfer_to_folio_id = $3::uuid, updated_at = NOW(), updated_by = $4::uuid
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid`,
      [command.posting_id, tenantId, targetFolioId, actorId],
    );

    // 3. Create TRANSFER CREDIT on source folio (reduces balance)
    await queryWithClient(client,
      `INSERT INTO charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         quantity, unit_price, subtotal, total_amount, currency_code,
         department_code, transfer_from_folio_id, transfer_to_folio_id,
         original_posting_id, business_date, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'TRANSFER', 'CREDIT', $5, $6,
         $7, $8, $9, $10, $11,
         $12, $3::uuid, $13::uuid,
         $14::uuid, CURRENT_DATE, $15,
         $16::uuid, $16::uuid
       )`,
      [
        tenantId, original.property_id, original.folio_id, original.reservation_id,
        original.charge_code, `Transfer out: ${original.charge_description}`,
        original.quantity, original.unit_price, original.subtotal, original.total_amount, original.currency_code,
        original.department_code, targetFolioId,
        command.posting_id, command.reason ?? `Charge transferred to another folio`,
        actorId,
      ],
    );

    // 4. Create TRANSFER DEBIT on target folio (increases balance)
    const { rows: newRows } = await queryWithClient<{ posting_id: string }>(client,
      `INSERT INTO charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         quantity, unit_price, subtotal, total_amount, currency_code,
         department_code, transfer_from_folio_id,
         original_posting_id, business_date, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'TRANSFER', 'DEBIT', $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13::uuid,
         $14::uuid, CURRENT_DATE, $15,
         $16::uuid, $16::uuid
       )
       RETURNING posting_id`,
      [
        tenantId, original.property_id, targetFolioId, original.reservation_id,
        original.charge_code, `Transfer in: ${original.charge_description}`,
        original.quantity, original.unit_price, original.subtotal, original.total_amount, original.currency_code,
        original.department_code, original.folio_id,
        command.posting_id, command.reason ?? `Charge transferred from another folio`,
        actorId,
      ],
    );

    // 5. Adjust source folio balance (decrease)
    await queryWithClient(client,
      `UPDATE folios
       SET total_charges = total_charges - $2,
           balance = balance - $2,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
      [tenantId, amount, actorId, original.folio_id],
    );

    // 6. Adjust target folio balance (increase)
    await queryWithClient(client,
      `UPDATE folios
       SET total_charges = total_charges + $2,
           balance = balance + $2,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
      [tenantId, amount, actorId, targetFolioId],
    );

    const newPostingId = newRows[0]?.posting_id ?? command.posting_id;
    appLogger.info(
      { originalPostingId: command.posting_id, newPostingId, fromFolio: original.folio_id, toFolio: targetFolioId, amount },
      "Charge transferred between folios",
    );
    return newPostingId;
  });
};

/**
 * Split a charge across multiple folios.
 * Voids the original posting and creates partial-amount postings on each target folio.
 */
export const splitCharge = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioSplitCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  return withTransaction(async (client) => {
    // 1. Fetch and lock the original posting
    const { rows } = await queryWithClient<{
      posting_id: string;
      folio_id: string;
      property_id: string;
      reservation_id: string | null;
      charge_code: string;
      charge_description: string;
      total_amount: string;
      currency_code: string;
      department_code: string | null;
      is_voided: boolean;
    }>(
      client,
      `SELECT posting_id, folio_id, property_id, reservation_id,
              charge_code, charge_description, total_amount, currency_code,
              department_code, is_voided
       FROM charge_postings
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.posting_id, tenantId],
    );

    const original = rows[0];
    if (!original) {
      throw new BillingCommandError("POSTING_NOT_FOUND", `Posting ${command.posting_id} not found.`);
    }
    if (original.is_voided) {
      throw new BillingCommandError("POSTING_VOIDED", "Cannot split a voided posting.");
    }

    const originalAmount = parseDbMoneyOrZero(original.total_amount);
    const splitTotal = command.splits.reduce((sum, s) => addMoney(sum, s.amount), 0);
    if (Math.abs(splitTotal - originalAmount) > 0.01) {
      throw new BillingCommandError(
        "SPLIT_AMOUNT_MISMATCH",
        `Split amounts sum to ${splitTotal} but original posting is ${originalAmount}.`,
      );
    }

    // 2. Void the original posting
    await queryWithClient(client,
      `UPDATE charge_postings
       SET is_voided = TRUE, voided_at = NOW(), voided_by = $3::uuid,
           void_reason = 'Split into multiple folios', version = version + 1,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid`,
      [command.posting_id, tenantId, actorId],
    );

    // 3. Decrease source folio balance for the voided original
    await queryWithClient(client,
      `UPDATE folios
       SET total_charges = total_charges - $2,
           balance = balance - $2,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
      [tenantId, originalAmount, actorId, original.folio_id],
    );

    // 4. Create split postings on each target folio
    const splitIds: string[] = [];
    for (const split of command.splits) {
      let targetFolioId = split.folio_id ?? null;
      if (!targetFolioId && split.reservation_id) {
        const fid = await resolveFolioId(tenantId, split.reservation_id);
        targetFolioId = fid;
      }
      if (!targetFolioId) {
        throw new BillingCommandError("FOLIO_NOT_FOUND", "Unable to locate target folio for split.");
      }

      const unitPrice = split.amount;
      const desc = split.description ?? `Split: ${original.charge_description}`;

      const { rows: newRows } = await queryWithClient<{ posting_id: string }>(client,
        `INSERT INTO charge_postings (
           tenant_id, property_id, folio_id, reservation_id,
           transaction_type, posting_type, charge_code, charge_description,
           quantity, unit_price, subtotal, total_amount, currency_code,
           department_code, original_posting_id, business_date,
           notes, created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid,
           'CHARGE', 'DEBIT', $5, $6,
           1, $7, $7, $7, $8,
           $9, $10::uuid, CURRENT_DATE,
           $11, $12::uuid, $12::uuid
         )
         RETURNING posting_id`,
        [
          tenantId, original.property_id, targetFolioId, original.reservation_id,
          original.charge_code, desc,
          unitPrice, original.currency_code,
          original.department_code,
          command.posting_id,
          command.reason ?? `Split from posting ${command.posting_id}`,
          actorId,
        ],
      );

      // Update target folio balance
      await queryWithClient(client,
        `UPDATE folios
         SET total_charges = total_charges + $2,
             balance = balance + $2,
             updated_at = NOW(), updated_by = $3::uuid
         WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
        [tenantId, unitPrice, actorId, targetFolioId],
      );

      if (newRows[0]?.posting_id) {
        splitIds.push(newRows[0].posting_id);
      }
    }

    appLogger.info(
      { originalPostingId: command.posting_id, splitCount: command.splits.length, splitIds },
      "Charge split across folios",
    );
    return splitIds[0] ?? command.posting_id;
  });
};

// ─── Accounts Receivable Handlers ────────────────────────────────────────────

/** Map textual payment_terms to number of days. */
const paymentTermsToDays = (terms: string): number => {
  switch (terms.toLowerCase()) {
    case "due_on_receipt": return 0;
    case "net_15": return 15;
    case "net_30": return 30;
    case "net_45": return 45;
    case "net_60": return 60;
    case "net_90": return 90;
    default: return 30;
  }
};

/**
 * Post an AR entry (e.g., on checkout for direct-bill guests).
 * Creates a row in accounts_receivable with status "open" and aging_bucket "current".
 */
export const postArEntry = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingArPostCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  const days = paymentTermsToDays(command.payment_terms);
  const arNumber = `AR-${Date.now()}-${randomUUID().slice(0, 8)}`;

  // look up property_id from the reservation
  const { rows: resRows } = await query<{ property_id: string }>(
    `SELECT property_id FROM reservations WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    [command.reservation_id, tenantId],
  );
  const propertyId = resRows[0]?.property_id;
  if (!propertyId) {
    throw new BillingCommandError("RESERVATION_NOT_FOUND", `Reservation ${command.reservation_id} not found.`);
  }

  const { rows } = await query<{ ar_id: string }>(
    `INSERT INTO accounts_receivable (
       tenant_id, property_id, ar_number, account_type, account_id, account_name,
       source_type, reservation_id, folio_id,
       transaction_date, due_date,
       original_amount, outstanding_balance, currency,
       ar_status, aging_bucket, payment_terms, payment_terms_days,
       notes, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5::uuid, $6,
       'reservation', $7::uuid, $8,
       CURRENT_DATE, CURRENT_DATE + $9::int,
       $10, $10, 'USD',
       'open', 'current', $11, $9,
       $12, $13::uuid, $13::uuid
     )
     RETURNING ar_id`,
    [
      tenantId, propertyId, arNumber,
      command.account_type, command.account_id, command.account_name,
      command.reservation_id, command.folio_id ?? null,
      days,
      command.amount,
      command.payment_terms,
      command.notes ?? null,
      actorId,
    ],
  );

  const arId = rows[0]?.ar_id ?? arNumber;
  appLogger.info({ arId, arNumber, amount: command.amount, accountName: command.account_name }, "AR entry posted");
  return arId;
};

/**
 * Apply a payment against an outstanding AR balance.
 */
export const applyArPayment = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingArApplyPaymentCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  return withTransaction(async (client) => {
    // fetch and lock the AR entry
    const { rows } = await queryWithClient<{
      ar_id: string;
      outstanding_balance: string;
      paid_amount: string;
      payment_count: number;
      payments: unknown;
      ar_status: string;
    }>(
      client,
      `SELECT ar_id, outstanding_balance, paid_amount, payment_count, payments, ar_status
       FROM accounts_receivable
       WHERE ar_id = $1::uuid AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.ar_id, tenantId],
    );

    const ar = rows[0];
    if (!ar) {
      throw new BillingCommandError("AR_NOT_FOUND", `AR entry ${command.ar_id} not found.`);
    }
    if (ar.ar_status === "paid" || ar.ar_status === "written_off" || ar.ar_status === "cancelled") {
      throw new BillingCommandError("AR_CLOSED", `AR entry is already ${ar.ar_status}.`);
    }

    const outstanding = parseDbMoneyOrZero(ar.outstanding_balance);
    const paymentAmount = Math.min(command.amount, outstanding);
    const newOutstanding = subtractMoney(outstanding, paymentAmount);
    const newPaid = addMoney(parseDbMoneyOrZero(ar.paid_amount), paymentAmount);
    const newStatus = newOutstanding <= 0.005 ? "paid" : "partial";

    // append to payments JSONB array
    const existingPayments = Array.isArray(ar.payments) ? ar.payments : [];
    const paymentEntry = {
      date: (command.payment_date ?? new Date()).toISOString().slice(0, 10),
      amount: paymentAmount,
      method: command.payment_method ?? "UNKNOWN",
      reference: command.payment_reference,
    };
    const updatedPayments = [...existingPayments, paymentEntry];

    await queryWithClient(client,
      `UPDATE accounts_receivable
       SET outstanding_balance = $3,
           paid_amount = $4,
           ar_status = $5,
           payment_count = payment_count + 1,
           last_payment_date = $6::date,
           last_payment_amount = $7,
           payments = $8::jsonb,
           is_overdue = CASE WHEN $5 = 'paid' THEN false ELSE is_overdue END,
           updated_at = NOW(), updated_by = $9::uuid
       WHERE ar_id = $1::uuid AND tenant_id = $2::uuid`,
      [
        command.ar_id, tenantId,
        newOutstanding, newPaid, newStatus,
        paymentEntry.date, paymentAmount,
        JSON.stringify(updatedPayments),
        actorId,
      ],
    );

    appLogger.info(
      { arId: command.ar_id, paymentAmount, newOutstanding, newStatus },
      "AR payment applied",
    );
    return command.ar_id;
  });
};

/**
 * Recalculate aging buckets for all open AR entries in a property.
 */
export const ageArEntries = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingArAgeCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const asOfDate = command.as_of_date ? new Date(command.as_of_date).toISOString().slice(0, 10) : null;

  const result = await query<{ updated: string }>(
    `WITH aged AS (
       UPDATE accounts_receivable
       SET
         days_overdue = GREATEST(0, ($3::date - due_date)::int),
         is_overdue = (($3::date - due_date)::int > 0),
         aging_bucket = CASE
           WHEN ($3::date - due_date)::int <= 0 THEN 'current'
           WHEN ($3::date - due_date)::int <= 30 THEN '1_30_days'
           WHEN ($3::date - due_date)::int <= 60 THEN '31_60_days'
           WHEN ($3::date - due_date)::int <= 90 THEN '61_90_days'
           WHEN ($3::date - due_date)::int <= 120 THEN '91_120_days'
           ELSE 'over_120_days'
         END,
         aging_days = GREATEST(0, ($3::date - due_date)::int),
         ar_status = CASE
           WHEN ar_status = 'open' AND ($3::date - due_date)::int > 0 THEN 'overdue'
           WHEN ar_status = 'partial' AND ($3::date - due_date)::int > 0 THEN 'overdue'
           ELSE ar_status
         END,
         updated_at = NOW()
       WHERE tenant_id = $1::uuid
         AND property_id = $2::uuid
         AND ar_status IN ('open', 'partial', 'overdue')
         AND COALESCE(is_deleted, false) = false
       RETURNING ar_id
     )
     SELECT COUNT(*)::text AS updated FROM aged`,
    [tenantId, command.property_id, asOfDate],
  );

  const updatedCount = result.rows[0]?.updated ?? "0";
  appLogger.info({ propertyId: command.property_id, updatedCount }, "AR aging recalculated");
  return updatedCount;
};

/**
 * Write off an uncollectible AR entry.
 */
export const writeOffAr = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingArWriteOffCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  const { rows } = await query<{ ar_id: string; outstanding_balance: string }>(
    `SELECT ar_id, outstanding_balance FROM accounts_receivable
     WHERE ar_id = $1::uuid AND tenant_id = $2::uuid
       AND ar_status NOT IN ('paid', 'written_off', 'cancelled')`,
    [command.ar_id, tenantId],
  );

  const ar = rows[0];
  if (!ar) {
    throw new BillingCommandError("AR_NOT_FOUND", `AR entry ${command.ar_id} not found or already closed.`);
  }

  const outstanding = parseDbMoneyOrZero(ar.outstanding_balance);
  const writeOffAmount = Math.min(command.write_off_amount, outstanding);
  const newOutstanding = subtractMoney(outstanding, writeOffAmount);
  const newStatus = newOutstanding <= 0.005 ? "written_off" : "partial";

  await query(
    `UPDATE accounts_receivable
     SET written_off = TRUE,
         write_off_amount = COALESCE(write_off_amount, 0) + $3,
         write_off_reason = $4,
         write_off_date = CURRENT_DATE,
         written_off_by = $5::uuid,
         write_off_approved_by = $6,
         outstanding_balance = $7,
         ar_status = $8,
         is_bad_debt = CASE WHEN $8 = 'written_off' THEN TRUE ELSE is_bad_debt END,
         updated_at = NOW(), updated_by = $5::uuid
     WHERE ar_id = $1::uuid AND tenant_id = $2::uuid`,
    [
      command.ar_id, tenantId,
      writeOffAmount, command.reason,
      actorId, command.approved_by ?? null,
      newOutstanding, newStatus,
    ],
  );

  appLogger.info(
    { arId: command.ar_id, writeOffAmount, newOutstanding, newStatus },
    "AR entry written off",
  );
  return command.ar_id;
};
