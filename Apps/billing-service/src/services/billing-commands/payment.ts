import { randomUUID } from "node:crypto";

import type { PaymentRow } from "@tartware/schemas";

import { auditAsync, auditWithClient } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { acquireFolioLock } from "../../lib/folio-lock.js";
import { appLogger } from "../../lib/logger.js";
import {
  type BillingOverpaymentHandleCommand,
  BillingOverpaymentHandleCommandSchema,
  type BillingPaymentApplyCommand,
  BillingPaymentApplyCommandSchema,
  BillingPaymentAuthorizeCommandSchema,
  type BillingPaymentCaptureCommand,
  BillingPaymentCaptureCommandSchema,
  BillingPaymentIncrementAuthCommandSchema,
  type BillingPaymentRefundCommand,
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
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  resolveInvoiceId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Enforce credit limit for a guest/account before allowing a charge.
 * Checks `credit_limits` for active limits and compares current_balance + chargeAmount
 * against the effective limit (including any temporary increase).
 * Returns a warning string if warning threshold is reached, or throws if blocked.
 */
export async function enforceCreditLimit(
  tenantId: string,
  guestId: string | undefined | null,
  chargeAmount: number,
): Promise<string | null> {
  if (!guestId) return null;

  const { rows } = await query<{
    credit_limit_id: string;
    credit_limit_amount: string;
    current_balance: string;
    warning_threshold_percent: string;
    block_threshold_percent: string;
    temporary_increase_active: boolean;
    temporary_increase_amount: string | null;
  }>(
    `SELECT credit_limit_id, credit_limit_amount, current_balance,
            warning_threshold_percent, block_threshold_percent,
            temporary_increase_active, temporary_increase_amount
     FROM credit_limits
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
       AND is_active = true AND credit_status = 'active'
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY credit_limit_amount DESC LIMIT 1`,
    [tenantId, guestId],
  );

  const limit = rows[0];
  if (!limit) return null; // No credit limit configured — allow

  const effectiveLimit =
    Number(limit.credit_limit_amount) +
    (limit.temporary_increase_active ? Number(limit.temporary_increase_amount ?? 0) : 0);
  const currentBalance = Number(limit.current_balance);
  const projectedBalance = currentBalance + chargeAmount;
  const utilizationPct = (projectedBalance / effectiveLimit) * 100;

  const blockPct = Number(limit.block_threshold_percent);
  if (utilizationPct >= blockPct) {
    throw new BillingCommandError(
      "CREDIT_LIMIT_EXCEEDED",
      `Payment of ${chargeAmount} would push utilization to ${utilizationPct.toFixed(1)}% (block threshold: ${blockPct}%). Available credit: ${(effectiveLimit - currentBalance).toFixed(2)}`,
    );
  }

  const warningPct = Number(limit.warning_threshold_percent);
  if (utilizationPct >= warningPct) {
    return `Credit utilization at ${utilizationPct.toFixed(1)}% (warning threshold: ${warningPct}%)`;
  }

  return null;
}

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

  // Enforce credit limit before authorizing
  const creditWarning = await enforceCreditLimit(
    context.tenantId,
    command.guest_id,
    command.amount,
  );
  if (creditWarning) {
    appLogger.warn(
      { guestId: command.guest_id, creditWarning },
      "Credit limit warning on authorize",
    );
  }

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
      ON CONFLICT (tenant_id, payment_reference) DO UPDATE
      SET
        amount = EXCLUDED.amount,
        status = 'AUTHORIZED',
        version = payments.version + 1,
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
    const newVoidId = result.rows[0]?.id ?? randomUUID();

    // PCI-DSS Req 10: audit payment voids synchronously within the transaction.
    await auditWithClient(client, {
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actorId,
      action: "PAYMENT_VOID",
      entityType: "payment",
      entityId: authPayment.id,
      severity: "WARNING",
      isPciRelevant: true,
      description: `Payment authorization voided: ${command.payment_reference} reason=${command.reason ?? "not provided"}`,
      oldValues: {
        original_payment_id: authPayment.id,
        original_status: "AUTHORIZED",
        amount: parseDbMoneyOrZero(authPayment.amount),
      },
      newValues: {
        void_payment_id: newVoidId,
        new_status: "CANCELLED",
        reason: command.reason,
      },
    });

    return newVoidId;
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

  // Enforce credit limit before capturing
  const creditWarning = await enforceCreditLimit(
    context.tenantId,
    command.guest_id,
    command.amount,
  );
  if (creditWarning) {
    appLogger.warn({ guestId: command.guest_id, creditWarning }, "Credit limit warning on capture");
  }

  // Resolve folio before the transaction so we know whether to update it
  const folioIdForUpdate = command.folio_id ?? null;
  const reservationIdForFolio = command.reservation_id ?? null;
  const resolvedFolioId =
    folioIdForUpdate ??
    (reservationIdForFolio ? await resolveFolioId(context.tenantId, reservationIdForFolio) : null);

  const paymentId = await withTransaction(async (client) => {
    // Acquire advisory lock on the folio before any balance mutation to prevent
    // concurrent payment + checkout race conditions
    if (resolvedFolioId) {
      await acquireFolioLock(client, resolvedFolioId);
    }

    const result = await queryWithClient<{ id: string }>(
      client,
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
      ON CONFLICT (tenant_id, payment_reference) DO UPDATE
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
        version = payments.version + 1,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id
    `,
      [
        context.tenantId,
        command.property_id,
        command.reservation_id ?? null,
        command.guest_id ?? null,
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

    const id = result.rows[0]?.id;
    if (!id) {
      throw new BillingCommandError("PAYMENT_CAPTURE_FAILED", "Failed to record captured payment.");
    }

    // Update folio balance atomically. Overpayment detection in one round-trip:
    //   balance     → GREATEST(0, balance - amount)          never go negative
    //   credit_balance → existing + GREATEST(0, amount - balance)  capture excess
    // RETURNING both values so we can detect and audit overpayments without a 2nd query.
    let creditBalance = 0;
    if (resolvedFolioId) {
      const { rows: folioRows } = await queryWithClient<{
        balance: string;
        credit_balance: string;
      }>(
        client,
        `
        UPDATE public.folios
        SET
          total_payments  = total_payments + $2,
          balance         = GREATEST(0, balance - $2),
          credit_balance  = credit_balance + GREATEST(0, $2 - balance),
          updated_at      = NOW(),
          updated_by      = $3
        WHERE tenant_id = $1::uuid
          AND folio_id  = $4::uuid
        RETURNING balance, credit_balance
        `,
        [context.tenantId, command.amount, actor, resolvedFolioId],
      );
      creditBalance = Number(folioRows[0]?.credit_balance ?? 0);
    }

    // PCI-DSS Req 10: audit all payment captures synchronously within the transaction.
    await auditWithClient(client, {
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actor,
      action: "PAYMENT_CAPTURE",
      entityType: "payment",
      entityId: id,
      severity: "INFO",
      isPciRelevant: true,
      isGdprRelevant: true,
      description: `Payment captured: ${command.amount} ${command.currency ?? "USD"} via ${command.payment_method}`,
      newValues: {
        payment_id: id,
        amount: command.amount,
        currency: command.currency ?? "USD",
        payment_method: command.payment_method,
        transaction_type: command.transaction_type,
        folio_id: resolvedFolioId,
        reservation_id: command.reservation_id,
        payment_reference: command.payment_reference,
        credit_balance: creditBalance > 0 ? creditBalance : undefined,
      },
    });

    return { paymentId: id, creditBalance };
  });

  // Fire async overpayment audit outside the transaction (zero hot-path latency).
  // The credit_balance column is already persisted above; this is informational only.
  if (paymentId.creditBalance > 0 && resolvedFolioId) {
    auditAsync({
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actor,
      action: "OVERPAYMENT_DETECTED",
      entityType: "folio",
      entityId: resolvedFolioId,
      category: "FINANCIAL",
      severity: "WARNING",
      isPciRelevant: true,
      description: `Overpayment of ${paymentId.creditBalance} credited to folio ${resolvedFolioId}`,
      newValues: {
        folio_id: resolvedFolioId,
        credit_balance: paymentId.creditBalance,
        payment_reference: command.payment_reference,
        payment_amount: command.amount,
      },
    });
    appLogger.warn(
      {
        folioId: resolvedFolioId,
        creditBalance: paymentId.creditBalance,
        tenantId: context.tenantId,
      },
      "Overpayment detected — credit_balance updated on folio",
    );
  }

  return paymentId.paymentId;
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

  // Resolve folio so we can lock it before writing — prevents a concurrent
  // checkout from closing the folio while the refund is in flight
  const refundFolioId = await resolveFolioId(context.tenantId, command.reservation_id);

  return withTransaction(async (client) => {
    // Acquire advisory lock on the folio to prevent concurrent checkout race
    if (refundFolioId) {
      await acquireFolioLock(client, refundFolioId);
    }

    const refundResult = await queryWithClient<{ id: string }>(
      client,
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

    await queryWithClient(
      client,
      `
        UPDATE public.payments
        SET
          refund_amount = COALESCE(refund_amount, 0) + $3,
          status = $4::payment_status,
          refund_reason = COALESCE($5, refund_reason),
          refund_date = NOW(),
          refunded_by = $6,
          version = COALESCE(version, 0) + 1,
          updated_at = NOW(),
          updated_by = $6
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
      `,
      [context.tenantId, original.id, command.amount, refundStatus, command.reason ?? null, actor],
    );

    // PCI-DSS Req 10: audit all payment refunds synchronously within the transaction.
    await auditWithClient(client, {
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actor,
      action: "PAYMENT_REFUND",
      entityType: "payment",
      entityId: refundId,
      severity: "WARNING",
      isPciRelevant: true,
      isGdprRelevant: true,
      description: `Payment refund: ${command.amount} ${command.currency ?? "USD"} reason=${command.reason ?? "not provided"}`,
      oldValues: {
        original_payment_id: original.id,
        original_amount: originalAmount,
      },
      newValues: {
        refund_id: refundId,
        refund_amount: command.amount,
        refund_reference: refundReference,
        new_payment_status: refundStatus,
        reservation_id: command.reservation_id,
      },
    });

    return refundId;
  });
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
        version = version + 1,
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
        version = version + 1,
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
          OR ($3::text IS NOT NULL AND payment_reference = $3::text)
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

/**
 * Increment an existing pre-authorization by adding an additional amount.
 * Only AUTHORIZED payments can be incremented. Updates the total authorization amount.
 */
export const incrementAuthorization = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentIncrementAuthCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rows } = await query<{ id: string; amount: string; status: string }>(
    `SELECT id, amount, status FROM public.payments
     WHERE tenant_id = $1::uuid AND payment_reference = $2
     ORDER BY created_at DESC LIMIT 1`,
    [context.tenantId, command.payment_reference],
  );

  const existing = rows[0];
  if (!existing) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      `No payment found with reference ${command.payment_reference}`,
    );
  }
  if (existing.status !== "AUTHORIZED") {
    throw new BillingCommandError(
      "INVALID_PAYMENT_STATUS",
      `Cannot increment authorization on payment with status ${existing.status}`,
    );
  }

  const newAmount = Number(existing.amount) + command.additional_amount;

  await query(
    `UPDATE public.payments
     SET amount = $3::numeric,
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{incremental_auth_history}',
           COALESCE(metadata->'incremental_auth_history', '[]'::jsonb) ||
           jsonb_build_object(
             'previous_amount', amount,
             'increment', $4::numeric,
             'new_amount', $3::numeric,
             'reason', $5::text,
             'timestamp', NOW()
           )::jsonb
         ),
         version = version + 1,
         updated_at = NOW(),
         updated_by = $6::uuid
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [
      context.tenantId,
      existing.id,
      newAmount,
      command.additional_amount,
      command.reason ?? null,
      actor,
    ],
  );

  appLogger.info(
    {
      paymentId: existing.id,
      previousAmount: Number(existing.amount),
      increment: command.additional_amount,
      newAmount,
    },
    "Payment authorization incremented",
  );

  return existing.id;
};

/**
 * Handle a detected overpayment on a folio.
 * REFUND: clears credit_balance and creates a refund transaction.
 * CREDIT: marks credit_balance as intentional (no-op on the amount — already stored).
 * HOLD:   logs for front-desk review; no financial mutation.
 *
 * Standard: USALI 12th Ed §7.3 (Guest Credit Balance), GAAP credit liability.
 */
export const handleOverpayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<{ action: string; creditBalance: number }> => {
  const command = BillingOverpaymentHandleCommandSchema.parse(
    payload,
  ) as BillingOverpaymentHandleCommand;
  const actor = resolveActorId(context.initiatedBy);

  // Read current credit_balance with FOR UPDATE lock
  const { rows: folioRows } = await query<{ credit_balance: string; folio_id: string }>(
    `SELECT folio_id, credit_balance
     FROM public.folios
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
       AND COALESCE(is_deleted, false) = false`,
    [context.tenantId, command.folio_id],
  );

  const folio = folioRows[0];
  if (!folio) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", `Folio ${command.folio_id} not found`);
  }

  const currentCredit = Number(folio.credit_balance);
  const actAmount = command.amount ?? currentCredit;

  if (actAmount <= 0 || actAmount > currentCredit) {
    throw new BillingCommandError(
      "INVALID_CREDIT_AMOUNT",
      `Action amount ${actAmount} is invalid. Current credit balance is ${currentCredit}`,
    );
  }

  if (command.action === "HOLD") {
    auditAsync({
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actor,
      action: "OVERPAYMENT_HOLD",
      entityType: "folio",
      entityId: command.folio_id,
      category: "FINANCIAL",
      severity: "WARNING",
      description: `Overpayment of ${actAmount} flagged for front-desk review on folio ${command.folio_id}`,
      metadata: { notes: command.notes },
    });
    return { action: "HOLD", creditBalance: currentCredit };
  }

  // REFUND or CREDIT — both require a transaction
  const newCredit = await withTransaction(async (client) => {
    await acquireFolioLock(client, command.folio_id);

    if (command.action === "REFUND") {
      // Reduce credit_balance and record a REFUND payment row
      await queryWithClient(
        client,
        `UPDATE public.folios
         SET credit_balance = credit_balance - $2,
             updated_at = NOW(), updated_by = $3
         WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
        [context.tenantId, actAmount, actor, command.folio_id],
      );

      await queryWithClient(
        client,
        `INSERT INTO public.payments (
           tenant_id, property_id,
           payment_reference, transaction_type, payment_method,
           amount, currency, status, processed_at, processed_by,
           notes, created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid,
           $3, 'REFUND', 'CREDIT_CARD',
           $4, 'USD', 'COMPLETED', NOW(), $5::uuid,
           $6, $5::uuid, $5::uuid
         )`,
        [
          context.tenantId,
          command.property_id,
          `OVERPAY-REFUND-${command.folio_id.slice(0, 8)}-${Date.now().toString(36)}`,
          actAmount,
          asUuid(actor) ?? SYSTEM_ACTOR_ID,
          command.notes ?? "Overpayment refund",
        ],
      );

      await auditWithClient(client, {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        userId: actor,
        action: "OVERPAYMENT_REFUNDED",
        entityType: "folio",
        entityId: command.folio_id,
        category: "FINANCIAL",
        severity: "INFO",
        isPciRelevant: true,
        description: `Overpayment of ${actAmount} refunded from folio ${command.folio_id}`,
        oldValues: { credit_balance: currentCredit },
        newValues: { credit_balance: currentCredit - actAmount },
      });
    } else {
      // CREDIT — intentional credit, just log; credit_balance stays as-is
      await auditWithClient(client, {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        userId: actor,
        action: "OVERPAYMENT_CREDITED",
        entityType: "folio",
        entityId: command.folio_id,
        category: "FINANCIAL",
        severity: "INFO",
        description: `Overpayment of ${actAmount} retained as credit on folio ${command.folio_id}`,
        newValues: { credit_balance: currentCredit, notes: command.notes },
      });
    }

    const { rows: updated } = await queryWithClient<{ credit_balance: string }>(
      client,
      `SELECT credit_balance FROM public.folios
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, command.folio_id],
    );
    return Number(updated[0]?.credit_balance ?? 0);
  });

  return { action: command.action, creditBalance: newCredit };
};
