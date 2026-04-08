import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingCreditNoteCreateCommandSchema,
  type BillingInvoiceAdjustCommand,
  BillingInvoiceAdjustCommandSchema,
  type BillingInvoiceCreateCommand,
  BillingInvoiceCreateCommandSchema,
  BillingInvoiceFinalizeCommandSchema,
  BillingInvoiceVoidCommandSchema,
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
  const currency = command.currency ?? "USD";

  return withTransaction(async (client) => {
    // Generate a collision-proof invoice number atomically inside the transaction.
    // If the caller provided one, use it; otherwise, derive one from a global DB-side
    // sequence (invoice_number_seq) for human-readable, monotonically increasing numbering.
    let invoiceNumber = command.invoice_number ?? null;
    if (!invoiceNumber) {
      const seqResult = await queryWithClient<{ seq: string }>(
        client,
        `SELECT nextval('invoice_number_seq') AS seq`,
        [],
      );
      const seq = seqResult.rows[0]?.seq ?? randomUUID().slice(0, 8);
      invoiceNumber = `INV-${seq}`;
    }

    const result = await queryWithClient<{ id: string }>(
      client,
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
        command.reservation_id ?? null,
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
  });
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
          WHEN $4::text IS NULL THEN notes
          WHEN notes IS NULL THEN $4::text
          ELSE CONCAT_WS(E'\\n', notes, $4::text)
        END,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $5::uuid
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
         version = version + 1,
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

// ─── Void Invoice ─────────────────────────────────────────────────────

/**
 * Void a DRAFT invoice. Only DRAFT invoices can be voided;
 * once an invoice has been sent or finalized, a credit note is required instead.
 */
export const voidInvoice = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingInvoiceVoidCommandSchema.parse(payload);
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  const { rows } = await query<{ id: string; status: string }>(
    `SELECT id, status FROM public.invoices
     WHERE tenant_id = $1::uuid AND id = $2::uuid
     LIMIT 1`,
    [context.tenantId, command.invoice_id],
  );

  const invoice = rows[0];
  if (!invoice) {
    throw new BillingCommandError("INVOICE_NOT_FOUND", "Invoice not found for voiding.");
  }
  if (invoice.status !== "DRAFT") {
    throw new BillingCommandError(
      "INVALID_INVOICE_STATUS",
      `Only DRAFT invoices can be voided. This invoice is ${invoice.status}. Use a credit note instead.`,
    );
  }

  await query(
    `UPDATE public.invoices
     SET status = 'VOIDED',
         notes = CASE
           WHEN $3::text IS NULL THEN notes
           WHEN notes IS NULL THEN CONCAT('VOIDED: ', $3::text)
           ELSE CONCAT_WS(E'\\n', notes, CONCAT('VOIDED: ', $3::text))
         END,
         version = version + 1,
         updated_at = NOW(),
         updated_by = $4::uuid
     WHERE tenant_id = $1::uuid
       AND id = $2::uuid`,
    [context.tenantId, command.invoice_id, command.reason ?? null, actor],
  );

  appLogger.info({ invoiceId: command.invoice_id }, "Invoice voided");
  return command.invoice_id;
};

// ─── Credit Note ──────────────────────────────────────────────────────

/**
 * Create a credit note against a finalized/sent/paid invoice.
 * Inserts a new invoice row with negative amounts and type CREDIT_NOTE,
 * linked to the original invoice via original_invoice_id.
 */
export const createCreditNote = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingCreditNoteCreateCommandSchema.parse(payload);
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  // Fetch original invoice
  const { rows } = await query<{
    id: string;
    status: string;
    total_amount: string;
    property_id: string;
    reservation_id: string | null;
    guest_id: string | null;
    currency: string;
  }>(
    `SELECT id, status, total_amount, property_id, reservation_id, guest_id, currency
     FROM public.invoices
     WHERE tenant_id = $1::uuid AND id = $2::uuid
     LIMIT 1`,
    [context.tenantId, command.original_invoice_id],
  );

  const original = rows[0];
  if (!original) {
    throw new BillingCommandError("INVOICE_NOT_FOUND", "Original invoice not found.");
  }

  const allowedStatuses = ["FINALIZED", "SENT", "VIEWED", "PAID", "PARTIALLY_PAID", "OVERDUE"];
  if (!allowedStatuses.includes(original.status)) {
    throw new BillingCommandError(
      "INVALID_INVOICE_STATUS",
      `Cannot issue credit note against ${original.status} invoice. Invoice must be issued first.`,
    );
  }

  const originalAmount = Number.parseFloat(original.total_amount);
  if (command.credit_amount > originalAmount) {
    throw new BillingCommandError(
      "CREDIT_EXCEEDS_ORIGINAL",
      `Credit amount (${command.credit_amount}) exceeds original invoice total (${originalAmount}).`,
    );
  }

  const creditNoteNumber = `CN-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const currency = command.currency ?? original.currency ?? "USD";

  const result = await query<{ id: string }>(
    `INSERT INTO public.invoices (
       tenant_id, property_id, reservation_id, guest_id,
       invoice_number, invoice_date, subtotal, total_amount,
       currency, notes, status, invoice_type,
       original_invoice_id, correction_type,
       metadata, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4,
       $5, CURRENT_DATE, -($6::numeric), -($6::numeric),
       UPPER($7), $8, 'FINALIZED', 'CREDIT_NOTE',
       $9::uuid, 'FULL_REVERSAL',
       $10::jsonb, $11, $11
     ) RETURNING id`,
    [
      context.tenantId,
      command.property_id,
      original.reservation_id,
      original.guest_id,
      creditNoteNumber,
      command.credit_amount,
      currency,
      command.reason ?? null,
      command.original_invoice_id,
      JSON.stringify(command.metadata ?? {}),
      actor,
    ],
  );

  const creditNoteId = result.rows[0]?.id;
  if (!creditNoteId) {
    throw new BillingCommandError("CREDIT_NOTE_FAILED", "Failed to create credit note.");
  }

  appLogger.info(
    {
      creditNoteId,
      originalInvoiceId: command.original_invoice_id,
      creditAmount: command.credit_amount,
    },
    "Credit note created",
  );

  return creditNoteId;
};
