/**
 * Billing command schemas — Invoice domain
 * Covers create, adjust, finalize, reopen, void, and credit notes.
 * @category commands
 */

import { z } from "zod";

export const BillingInvoiceCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid().optional(),
	guest_id: z.string().uuid(),
	invoice_number: z.string().max(50).optional(),
	invoice_date: z.coerce.date().optional(),
	due_date: z.coerce.date().optional(),
	total_amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingInvoiceCreateCommand = z.infer<
	typeof BillingInvoiceCreateCommandSchema
>;

export const BillingInvoiceAdjustCommandSchema = z
	.object({
		invoice_id: z.string().uuid(),
		adjustment_amount: z.coerce.number(),
		reason: z.string().max(500).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => value.adjustment_amount !== 0,
		"adjustment_amount cannot be zero",
	);

export type BillingInvoiceAdjustCommand = z.infer<
	typeof BillingInvoiceAdjustCommandSchema
>;

/**
 * Finalize an invoice, locking it for editing.
 * Only DRAFT or SENT invoices can be finalized.
 */
export const BillingInvoiceFinalizeCommandSchema = z.object({
	invoice_id: z.string().uuid(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingInvoiceFinalizeCommand = z.infer<
	typeof BillingInvoiceFinalizeCommandSchema
>;

/**
 * Reopen a FINALIZED invoice for correction.
 * Creates a new revision — the original invoice is set to SUPERSEDED status
 * and a sibling invoice is created at revision_number + 1.
 * Only Finance Manager and above may reopen a finalized invoice.
 */
export const BillingInvoiceReopenCommandSchema = z.object({
	invoice_id: z.string().uuid(),
	reason: z.string().min(1).max(1000),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingInvoiceReopenCommand = z.infer<
	typeof BillingInvoiceReopenCommandSchema
>;

/**
 * Void a DRAFT invoice that was never issued.
 * Industry standard: Only DRAFT invoices can be voided (deleted).
 * Issued invoices must be corrected via credit notes, never voided.
 */
export const BillingInvoiceVoidCommandSchema = z.object({
	invoice_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingInvoiceVoidCommand = z.infer<
	typeof BillingInvoiceVoidCommandSchema
>;

/**
 * Create a credit note against a finalized/sent/paid invoice.
 * Industry standard (EU VAT, US GAAP, HMRC): Issued invoices are never
 * modified or deleted. Corrections are always a separate credit note
 * document that references the original invoice. Full or partial amounts.
 */
export const BillingCreditNoteCreateCommandSchema = z.object({
	/** The original invoice being corrected. */
	original_invoice_id: z.string().uuid(),
	property_id: z.string().uuid(),
	/** Amount to credit — must be positive, cannot exceed original total. */
	credit_amount: z.coerce.number().positive(),
	/** Reason for the credit note (required for audit trail). */
	reason: z.string().min(3).max(1000),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCreditNoteCreateCommand = z.infer<
	typeof BillingCreditNoteCreateCommandSchema
>;
