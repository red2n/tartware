import { randomUUID } from "node:crypto";
import { auditAsync } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingCreditNoteCreateCommandSchema,
  type BillingInvoiceAdjustCommand,
  BillingInvoiceAdjustCommandSchema,
  type BillingInvoiceCreateCommand,
  BillingInvoiceCreateCommandSchema,
  BillingInvoiceFinalizeCommandSchema,
  BillingInvoiceReopenCommandSchema,
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
    // Invoice number is intentionally NOT assigned at creation time.
    // Per PMS accounting standard (BA §5.1), the invoice number must only be
    // assigned at FINALIZE time to maintain a gapless, audit-safe sequence.
    // If the caller explicitly provides invoice_number it is accepted as an
    // override (e.g. migration or system-generated reference).
    const invoiceNumber = command.invoice_number ?? null;

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
 * Assigns a permanent invoice_number from the global sequence if one has not
 * already been set (BA §5.1 — number assigned at finalization, not creation).
 */
const applyInvoiceFinalize = async (
  command: { invoice_id: string; metadata?: Record<string, unknown> },
  context: CommandContext,
): Promise<string> => {
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  const finalizedId = await withTransaction(async (client) => {
    const { rows } = await queryWithClient<{
      id: string;
      status: string;
      invoice_number: string | null;
    }>(
      client,
      `SELECT id, status, invoice_number FROM public.invoices
       WHERE tenant_id = $1::uuid AND id = $2::uuid
       FOR UPDATE`,
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

    // Assign invoice number from the global sequence at finalization time.
    // If the invoice already has a number (e.g. migrated drafts), preserve it.
    let invoiceNumber = invoice.invoice_number;
    if (!invoiceNumber) {
      const seqResult = await queryWithClient<{ seq: string }>(
        client,
        `SELECT nextval('invoice_number_seq') AS seq`,
        [],
      );
      const seq = seqResult.rows[0]?.seq ?? randomUUID().slice(0, 8);
      invoiceNumber = `INV-${seq}`;
    }

    await queryWithClient(
      client,
      `UPDATE public.invoices
       SET status = 'FINALIZED',
           invoice_number = $3,
           version = version + 1,
           updated_at = NOW(),
           updated_by = $4
       WHERE tenant_id = $1::uuid
         AND id = $2::uuid`,
      [context.tenantId, command.invoice_id, invoiceNumber, actor],
    );

    appLogger.info(
      { invoiceId: command.invoice_id, invoiceNumber, previousStatus: invoice.status },
      "Invoice finalized",
    );

    return command.invoice_id;
  });

  auditAsync({
    tenantId: context.tenantId,
    userId: actor,
    action: "INVOICE_FINALIZE",
    entityType: "invoice",
    entityId: finalizedId,
    severity: "INFO",
    description: `Invoice finalized and locked: ${finalizedId}`,
    newValues: { invoice_id: finalizedId },
  });

  return finalizedId;
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

  auditAsync({
    tenantId: context.tenantId,
    userId: actor,
    action: "INVOICE_VOID",
    entityType: "invoice",
    entityId: command.invoice_id,
    severity: "WARNING",
    description: `Invoice voided: ${command.invoice_id} reason=${command.reason ?? "not provided"}`,
    oldValues: { status: "DRAFT" },
    newValues: { status: "VOIDED", reason: command.reason },
  });

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

// ─── Reopen Invoice ──────────────────────────────────────────────────

/**
 * Reopen a FINALIZED invoice for post-checkout correction.
 *
 * Workflow (BA §5.2):
 * 1. Mark the existing FINALIZED invoice as SUPERSEDED (status change only).
 * 2. Create a sibling invoice that is a copy of the original at revision_number + 1.
 * 3. The new sibling starts in DRAFT so the user can adjust before re-finalizing.
 *
 * Returns the ID of the new draft sibling invoice.
 */
export const reopenInvoice = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingInvoiceReopenCommandSchema.parse(payload);
  const actor = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  return withTransaction(async (client) => {
    const { rows } = await queryWithClient<{
      id: string;
      status: string;
      revision_number: number | null;
      property_id: string;
      reservation_id: string | null;
      guest_id: string;
      total_amount: string;
      currency: string;
      due_date: string | null;
      notes: string | null;
    }>(
      client,
      `SELECT id, status, revision_number, property_id, reservation_id, guest_id,
              total_amount, currency, due_date, notes
       FROM public.invoices
       WHERE tenant_id = $1::uuid AND id = $2::uuid
       FOR UPDATE`,
      [context.tenantId, command.invoice_id],
    );

    const invoice = rows[0];
    if (!invoice) {
      throw new BillingCommandError("INVOICE_NOT_FOUND", "Invoice not found.");
    }
    if (invoice.status !== "FINALIZED") {
      throw new BillingCommandError(
        "INVALID_INVOICE_STATUS",
        `Only FINALIZED invoices can be reopened. This invoice is ${invoice.status}.`,
      );
    }

    // Mark original as SUPERSEDED
    await queryWithClient(
      client,
      `UPDATE public.invoices
       SET status = 'SUPERSEDED',
           notes = CONCAT_WS(E'\\n', notes, $3::text),
           version = version + 1,
           updated_at = NOW(), updated_by = $4
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [context.tenantId, invoice.id, `REOPENED: ${command.reason}`, actor],
    );

    const nextRevision = (invoice.revision_number ?? 0) + 1;

    // Create a new DRAFT sibling at revision_number + 1
    const { rows: newRows } = await queryWithClient<{ id: string }>(
      client,
      `INSERT INTO public.invoices (
         tenant_id, property_id, reservation_id, guest_id,
         invoice_date, due_date,
         subtotal, total_amount, currency,
         notes, status,
         correction_type, original_invoice_id, revision_number,
         metadata, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4::uuid,
         CURRENT_DATE, $5,
         $6::numeric, $6::numeric, UPPER($7),
         $8, 'DRAFT',
         'CORRECTION', $9::uuid, $10,
         '{}'::jsonb, $11, $11
       ) RETURNING id`,
      [
        context.tenantId,
        invoice.property_id,
        invoice.reservation_id ?? null,
        invoice.guest_id,
        invoice.due_date ?? null,
        invoice.total_amount,
        invoice.currency,
        command.reason,
        invoice.id,
        nextRevision,
        actor,
      ],
    );

    const newInvoiceId = newRows[0]?.id;
    if (!newInvoiceId) {
      throw new BillingCommandError("INVOICE_REOPEN_FAILED", "Failed to create revision draft.");
    }

    appLogger.info(
      {
        originalInvoiceId: invoice.id,
        newInvoiceId,
        revision: nextRevision,
        reason: command.reason,
      },
      "Invoice reopened — new draft revision created",
    );

    return newInvoiceId;
  });
};
