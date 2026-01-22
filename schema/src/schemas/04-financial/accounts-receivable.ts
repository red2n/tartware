/**
 * DEV DOC
 * Module: schemas/04-financial/accounts-receivable.ts
 * Description: AccountsReceivable Schema
 * Table: accounts_receivable
 * Category: 04-financial
 * Primary exports: AccountsReceivableSchema, CreateAccountsReceivableSchema, UpdateAccountsReceivableSchema
 * @table accounts_receivable
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * AccountsReceivable Schema
 * @table accounts_receivable
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete AccountsReceivable schema
 */
export const AccountsReceivableSchema = z.object({
	ar_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	ar_number: z.string(),
	ar_reference: z.string().optional(),
	account_type: z.string().optional(),
	account_id: uuid.optional(),
	account_name: z.string(),
	account_code: z.string().optional(),
	guest_id: uuid.optional(),
	company_id: uuid.optional(),
	contact_name: z.string().optional(),
	contact_email: z.string().optional(),
	contact_phone: z.string().optional(),
	billing_address: z.string().optional(),
	source_type: z.string().optional(),
	source_id: uuid.optional(),
	source_reference: z.string().optional(),
	reservation_id: uuid.optional(),
	invoice_id: uuid.optional(),
	folio_id: uuid.optional(),
	transaction_date: z.coerce.date(),
	due_date: z.coerce.date(),
	original_amount: money,
	outstanding_balance: money,
	paid_amount: money.optional(),
	currency: z.string().optional(),
	ar_status: z.string().optional(),
	is_overdue: z.boolean().optional(),
	days_overdue: z.number().int().optional(),
	aging_bucket: z.string().optional(),
	aging_days: z.number().int().optional(),
	payment_terms: z.string().optional(),
	payment_terms_days: z.number().int().optional(),
	early_payment_discount_percent: money.optional(),
	early_payment_discount_days: z.number().int().optional(),
	discount_deadline: z.coerce.date().optional(),
	discount_amount: money.optional(),
	discount_applied: z.boolean().optional(),
	late_fee_applicable: z.boolean().optional(),
	late_fee_percent: money.optional(),
	late_fee_fixed_amount: money.optional(),
	late_fees_charged: money.optional(),
	interest_applicable: z.boolean().optional(),
	interest_rate_percent: money.optional(),
	interest_accrued: money.optional(),
	last_interest_calculation_date: z.coerce.date().optional(),
	payment_count: z.number().int().optional(),
	last_payment_date: z.coerce.date().optional(),
	last_payment_amount: money.optional(),
	payments: z.record(z.unknown()).optional(),
	allows_partial_payment: z.boolean().optional(),
	minimum_payment_amount: money.optional(),
	in_collection: z.boolean().optional(),
	collection_started_date: z.coerce.date().optional(),
	collection_agency: z.string().optional(),
	collection_agent_id: uuid.optional(),
	collection_fee_percent: money.optional(),
	collection_notes: z.string().optional(),
	statement_sent_count: z.number().int().optional(),
	last_statement_sent_date: z.coerce.date().optional(),
	reminder_sent_count: z.number().int().optional(),
	last_reminder_sent_date: z.coerce.date().optional(),
	next_reminder_date: z.coerce.date().optional(),
	demand_letter_sent: z.boolean().optional(),
	demand_letter_sent_date: z.coerce.date().optional(),
	disputed: z.boolean().optional(),
	dispute_reason: z.string().optional(),
	dispute_amount: money.optional(),
	dispute_filed_date: z.coerce.date().optional(),
	dispute_resolved: z.boolean().optional(),
	dispute_resolution: z.string().optional(),
	written_off: z.boolean().optional(),
	write_off_amount: money.optional(),
	write_off_reason: z.string().optional(),
	write_off_date: z.coerce.date().optional(),
	written_off_by: uuid.optional(),
	write_off_approved_by: uuid.optional(),
	is_bad_debt: z.boolean().optional(),
	bad_debt_reserve: money.optional(),
	has_adjustments: z.boolean().optional(),
	adjustment_amount: money.optional(),
	adjustments: z.record(z.unknown()).optional(),
	credit_memo_applied: z.boolean().optional(),
	credit_memo_amount: money.optional(),
	credit_memo_ids: z.array(uuid).optional(),
	has_payment_plan: z.boolean().optional(),
	payment_plan_id: uuid.optional(),
	installment_count: z.number().int().optional(),
	installment_amount: money.optional(),
	next_installment_due_date: z.coerce.date().optional(),
	has_guarantor: z.boolean().optional(),
	guarantor_name: z.string().optional(),
	guarantor_contact: z.string().optional(),
	guarantor_liable_amount: money.optional(),
	legal_action_taken: z.boolean().optional(),
	legal_action_date: z.coerce.date().optional(),
	legal_action_type: z.string().optional(),
	legal_case_number: z.string().optional(),
	legal_notes: z.string().optional(),
	settlement_offered: z.boolean().optional(),
	settlement_amount: money.optional(),
	settlement_accepted: z.boolean().optional(),
	settlement_date: z.coerce.date().optional(),
	priority: z.string().optional(),
	collection_probability_percent: money.optional(),
	account_manager_id: uuid.optional(),
	collection_manager_id: uuid.optional(),
	alert_sent: z.boolean().optional(),
	alert_level: z.string().optional(),
	next_action_date: z.coerce.date().optional(),
	next_action_type: z.string().optional(),
	gl_posted: z.boolean().optional(),
	gl_posted_at: z.coerce.date().optional(),
	gl_account: z.string().optional(),
	reconciled: z.boolean().optional(),
	reconciled_at: z.coerce.date().optional(),
	reconciled_by: uuid.optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type AccountsReceivable = z.infer<typeof AccountsReceivableSchema>;

/**
 * Schema for creating a new accounts receivable
 */
export const CreateAccountsReceivableSchema = AccountsReceivableSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAccountsReceivable = z.infer<
	typeof CreateAccountsReceivableSchema
>;

/**
 * Schema for updating a accounts receivable
 */
export const UpdateAccountsReceivableSchema =
	AccountsReceivableSchema.partial();

export type UpdateAccountsReceivable = z.infer<
	typeof UpdateAccountsReceivableSchema
>;
