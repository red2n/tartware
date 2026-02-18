/**
 * DEV DOC
 * Module: schemas/04-financial/charge-postings.ts
 * Description: ChargePostings Schema
 * Table: charge_postings
 * Category: 04-financial
 * Primary exports: ChargePostingsSchema, CreateChargePostingsSchema, UpdateChargePostingsSchema
 * @table charge_postings
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * ChargePostings Schema
 * @table charge_postings
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete ChargePostings schema
 */
export const ChargePostingsSchema = z.object({
	posting_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	folio_id: uuid,
	reservation_id: uuid.optional(),
	guest_id: uuid.optional(),
	posting_date: z.coerce.date(),
	posting_time: z.coerce.date(),
	business_date: z.coerce.date(),
	transaction_type: z.string(),
	posting_type: z.string(),
	charge_code: z.string(),
	charge_description: z.string(),
	charge_category: z.string().optional(),
	quantity: money.optional(),
	unit_price: money,
	subtotal: money,
	tax_amount: money.optional(),
	service_charge: money.optional(),
	discount_amount: money.optional(),
	total_amount: money,
	currency_code: z.string().optional(),
	tax_rate: money.optional(),
	tax_code: z.string().optional(),
	tax_inclusive: z.boolean().optional(),
	payment_method: z.string().optional(),
	payment_reference: z.string().optional(),
	authorization_code: z.string().optional(),
	source_system: z.string().optional(),
	source_reference: z.string().optional(),
	outlet: z.string().optional(),
	department_code: z.string().optional(),
	revenue_center: z.string().optional(),
	gl_account: z.string().optional(),
	is_voided: z.boolean().optional(),
	voided_at: z.coerce.date().optional(),
	voided_by: uuid.optional(),
	void_reason: z.string().optional(),
	original_posting_id: uuid.optional(),
	void_posting_id: uuid.optional(),
	transfer_from_folio_id: uuid.optional(),
	transfer_to_folio_id: uuid.optional(),
	server_name: z.string().optional(),
	cashier_name: z.string().optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	is_reconciled: z.boolean().optional(),
	reconciled_at: z.coerce.date().optional(),
	reconciliation_batch: z.string().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type ChargePostings = z.infer<typeof ChargePostingsSchema>;

/**
 * Schema for creating a new charge postings
 */
export const CreateChargePostingsSchema = ChargePostingsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateChargePostings = z.infer<typeof CreateChargePostingsSchema>;

/**
 * Schema for updating a charge postings
 */
export const UpdateChargePostingsSchema = ChargePostingsSchema.partial();

export type UpdateChargePostings = z.infer<typeof UpdateChargePostingsSchema>;
