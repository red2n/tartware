/**
 * DEV DOC
 * Module: schemas/04-financial/invoices.ts
 * Description: Invoices Schema
 * Table: invoices
 * Category: 04-financial
 * Primary exports: InvoicesSchema, CreateInvoicesSchema, UpdateInvoicesSchema
 * @table invoices
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * Invoices Schema
 * @table invoices
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";
import { InvoiceStatusEnum } from "../../shared/enums.js";

/**
 * Complete Invoices schema
 */
export const InvoicesSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	guest_id: uuid,
	invoice_number: z.string(),
	invoice_type: z.string().optional(),
	invoice_date: z.coerce.date(),
	due_date: z.coerce.date().optional(),
	billing_from: z.coerce.date().optional(),
	billing_to: z.coerce.date().optional(),
	subtotal: money,
	tax_amount: money.optional(),
	discount_amount: money.optional(),
	total_amount: money,
	paid_amount: money.optional(),
	balance_due: money.optional(),
	currency: z.string().optional(),
	tax_breakdown: z.record(z.unknown()).optional(),
	status: InvoiceStatusEnum,
	payment_terms: z.string().optional(),
	payment_instructions: z.string().optional(),
	billing_address: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	footer_text: z.string().optional(),
	pdf_url: z.string().optional(),
	pdf_generated_at: z.coerce.date().optional(),
	sent_at: z.coerce.date().optional(),
	sent_to: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
	version: z.bigint().optional(),
});

export type Invoices = z.infer<typeof InvoicesSchema>;

/**
 * Schema for creating a new invoices
 */
export const CreateInvoicesSchema = InvoicesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateInvoices = z.infer<typeof CreateInvoicesSchema>;

/**
 * Schema for updating a invoices
 */
export const UpdateInvoicesSchema = InvoicesSchema.partial();

export type UpdateInvoices = z.infer<typeof UpdateInvoicesSchema>;
