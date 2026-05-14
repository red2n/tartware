import { auditAsync } from "../../lib/audit-logger.js";
import { query } from "../../lib/db.js";
import {
  type BillingPaymentApplyCommand,
  BillingPaymentApplyCommandSchema,
} from "../../schemas/billing-commands.js";

import {
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveInvoiceId,
} from "./common.js";

/**
 * Apply a payment to an invoice.
 */
export const applyPayment = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingPaymentApplyCommandSchema.parse(payload);
  return applyPaymentToInvoice(command, context);
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

  // ── Dedup guard: check if already applied ──
  if (payment.metadata?.applied_to_invoice_id === targetInvoiceId) {
    return targetInvoiceId;
  }
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
        AND version = $5
    `,
    [context.tenantId, command.payment_id, targetInvoiceId, actor, payment.version],
  );

  if (!markedApplied || markedApplied === 0) {
    throw new BillingCommandError(
      "CONCURRENT_MODIFICATION",
      "Payment modified by another transaction",
      true,
    );
  }

  const { rows: invoiceRows } = await query<{ id: string; version: number }>(
    `SELECT id, version FROM public.invoices WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
    [context.tenantId, targetInvoiceId],
  );
  const invoice = invoiceRows[0];
  if (!invoice) {
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
        version = version + 1,
        updated_at = NOW(),
        updated_by = $4
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid AND version = $5
      RETURNING id, total_amount, paid_amount
    `,
    [context.tenantId, targetInvoiceId, applyAmount, actor, invoice.version],
  );

  const invoiceId = rows[0]?.id;
  if (!invoiceId) {
    throw new BillingCommandError(
      "CONCURRENT_MODIFICATION",
      "Invoice modified by another transaction",
      true,
    );
  }
  auditAsync({
    tenantId: context.tenantId,
    userId: actor,
    action: "PAYMENT_APPLY",
    entityType: "invoice",
    entityId: invoiceId,
    severity: "INFO",
    isPciRelevant: true,
    description: `Applied payment ${command.payment_id} (${applyAmount}) to invoice ${invoiceId}`,
    newValues: {
      payment_id: command.payment_id,
      invoice_id: invoiceId,
      amount: applyAmount,
      total_amount: rows[0]?.total_amount,
      paid_amount: rows[0]?.paid_amount,
    },
  });
  return invoiceId;
};

const loadPaymentById = async (
  tenantId: string,
  paymentId: string,
): Promise<{
  amount: number;
  reservation_id: string | null;
  metadata: Record<string, unknown> | null;
  version: number;
} | null> => {
  const { rows } = await query<{
    amount: number;
    reservation_id: string | null;
    metadata: Record<string, unknown> | null;
    version: number;
  }>(
    `
      SELECT amount, reservation_id, metadata, version
      FROM public.payments
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      LIMIT 1
    `,
    [tenantId, paymentId],
  );
  return rows[0] ?? null;
};
