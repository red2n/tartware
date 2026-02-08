import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  type BillingChargePostCommand,
  BillingChargePostCommandSchema,
  BillingFolioCloseCommandSchema,
  type BillingFolioTransferCommand,
  BillingFolioTransferCommandSchema,
  type BillingInvoiceAdjustCommand,
  BillingInvoiceAdjustCommandSchema,
  type BillingInvoiceCreateCommand,
  BillingInvoiceCreateCommandSchema,
  BillingNightAuditCommandSchema,
  type BillingPaymentApplyCommand,
  BillingPaymentApplyCommandSchema,
  BillingPaymentAuthorizeCommandSchema,
  type BillingPaymentCaptureCommand,
  BillingPaymentCaptureCommandSchema,
  type BillingPaymentRefundCommand,
  BillingPaymentRefundCommandSchema,
  BillingPaymentVoidCommandSchema,
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
          $5,
          $6,
          1,
          $7,
          $7,
          $7,
          UPPER($8),
          NOW(),
          CURRENT_DATE,
          $9,
          $10::uuid,
          $10::uuid
        )
        RETURNING posting_id
      `,
      [
        context.tenantId,
        command.property_id,
        folioId,
        command.reservation_id,
        command.charge_code ?? "MISC",
        command.description ?? "Charge",
        command.amount,
        currency,
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
    throw new BillingCommandError("PAYMENT_AUTHORIZE_FAILED", "Failed to record payment authorization.");
  }
  return paymentId;
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
      id: string; room_rate: string; room_number: string;
      total_amount: string; guest_id: string;
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
          const taxResult = await queryWithClient<{ tax_code: string; tax_name: string; tax_rate: string }>(
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
            const taxAmount = Number((roomRate * taxRate / 100).toFixed(2));
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
                context.tenantId, command.property_id, folioId, res.id,
                `${tax.tax_name} (${taxRate}%)`,
                taxAmount, auditDate,
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
export const closeFolio = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
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
    [context.tenantId, folioId, newStatus, command.close_reason ?? null, actorId, settledAt, settledBy],
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
export const voidPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
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
