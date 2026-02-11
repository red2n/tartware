import { randomUUID } from "node:crypto";

import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  type BillingInvoiceAdjustCommand,
  BillingInvoiceAdjustCommandSchema,
  type BillingInvoiceCreateCommand,
  BillingInvoiceCreateCommandSchema,
  BillingInvoiceFinalizeCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

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
 * Finalize an invoice, locking it from further edits.
 * Only DRAFT or SENT invoices can be finalized.
 */
export const finalizeInvoice = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingInvoiceFinalizeCommandSchema.parse(payload);
  return applyInvoiceFinalize(command, context);
};

const applyInvoiceCreate = async (
  command: BillingInvoiceCreateCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
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
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
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

/**
 * Finalize an invoice. Transitions status from DRAFT or SENT to FINALIZED,
 * locking the invoice from further edits or adjustments.
 */
const applyInvoiceFinalize = async (
  command: { invoice_id: string; metadata?: Record<string, unknown> },
  context: CommandContext,
): Promise<string> => {
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

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
