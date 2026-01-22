/**
 * DEV DOC
 * Module: schemas/04-financial/refunds.ts
 * Description: Refunds Schema
 * Table: refunds
 * Category: 04-financial
 * Primary exports: RefundsSchema, CreateRefundsSchema, UpdateRefundsSchema
 * @table refunds
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * Refunds Schema
 * @table refunds
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete Refunds schema
 */
export const RefundsSchema = z.object({
	refund_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	refund_number: z.string().optional(),
	refund_type: z.string(),
	refund_status: z.string(),
	reservation_id: uuid.optional(),
	guest_id: uuid,
	folio_id: uuid.optional(),
	original_payment_id: uuid.optional(),
	original_posting_id: uuid.optional(),
	refund_amount: money,
	original_payment_amount: money.optional(),
	processing_fee: money.optional(),
	net_refund_amount: money.optional(),
	currency_code: z.string().optional(),
	original_payment_method: z.string().optional(),
	original_transaction_id: z.string().optional(),
	original_payment_date: z.coerce.date().optional(),
	refund_method: z.string(),
	card_last_four: z.string().optional(),
	card_type: z.string().optional(),
	bank_account_last_four: z.string().optional(),
	bank_routing_number: z.string().optional(),
	payee_name: z.string().optional(),
	reason_category: z.string(),
	reason_code: z.string().optional(),
	reason_description: z.string(),
	requested_at: z.coerce.date().optional(),
	requested_by: uuid,
	request_source: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approval_level: z.number().int().optional(),
	approved_at: z.coerce.date().optional(),
	approved_by: uuid.optional(),
	approval_notes: z.string().optional(),
	rejected_at: z.coerce.date().optional(),
	rejected_by: uuid.optional(),
	rejection_reason: z.string().optional(),
	processing_started_at: z.coerce.date().optional(),
	processing_started_by: uuid.optional(),
	processed_at: z.coerce.date().optional(),
	processed_by: uuid.optional(),
	processing_notes: z.string().optional(),
	transaction_id: z.string().optional(),
	authorization_code: z.string().optional(),
	processor_response: z.string().optional(),
	processor_reference: z.string().optional(),
	expected_completion_date: z.coerce.date().optional(),
	completed_at: z.coerce.date().optional(),
	days_to_complete: z.number().int().optional(),
	is_reconciled: z.boolean().optional(),
	reconciled_at: z.coerce.date().optional(),
	reconciliation_batch: z.string().optional(),
	gl_account: z.string().optional(),
	department_code: z.string().optional(),
	cost_center: z.string().optional(),
	is_chargeback: z.boolean().optional(),
	chargeback_date: z.coerce.date().optional(),
	chargeback_reason: z.string().optional(),
	chargeback_reference: z.string().optional(),
	guest_notified: z.boolean().optional(),
	notification_sent_at: z.coerce.date().optional(),
	notification_method: z.string().optional(),
	confirmation_number: z.string().optional(),
	is_full_refund: z.boolean().optional(),
	refund_percentage: money.optional(),
	is_taxable: z.boolean().optional(),
	tax_refunded: money.optional(),
	is_disputed: z.boolean().optional(),
	dispute_notes: z.string().optional(),
	is_fraudulent: z.boolean().optional(),
	fraud_notes: z.string().optional(),
	requires_investigation: z.boolean().optional(),
	parent_refund_id: uuid.optional(),
	split_refund_count: z.number().int().optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	guest_facing_notes: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type Refunds = z.infer<typeof RefundsSchema>;

/**
 * Schema for creating a new refunds
 */
export const CreateRefundsSchema = RefundsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateRefunds = z.infer<typeof CreateRefundsSchema>;

/**
 * Schema for updating a refunds
 */
export const UpdateRefundsSchema = RefundsSchema.partial();

export type UpdateRefunds = z.infer<typeof UpdateRefundsSchema>;
