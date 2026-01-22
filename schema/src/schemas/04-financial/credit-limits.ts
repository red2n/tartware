/**
 * DEV DOC
 * Module: schemas/04-financial/credit-limits.ts
 * Description: CreditLimits Schema
 * Table: credit_limits
 * Category: 04-financial
 * Primary exports: CreditLimitsSchema, CreateCreditLimitsSchema, UpdateCreditLimitsSchema
 * @table credit_limits
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * CreditLimits Schema
 * @table credit_limits
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete CreditLimits schema
 */
export const CreditLimitsSchema = z.object({
	credit_limit_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	account_type: z.string(),
	account_id: uuid,
	account_name: z.string(),
	account_code: z.string().optional(),
	guest_id: uuid.optional(),
	company_id: uuid.optional(),
	credit_limit_amount: money,
	currency: z.string().optional(),
	credit_status: z.string().optional(),
	is_active: z.boolean().optional(),
	effective_from: z.coerce.date(),
	effective_to: z.coerce.date().optional(),
	current_balance: money.optional(),
	available_credit: money.optional(),
	credit_utilization_percent: money.optional(),
	warning_threshold_percent: money.optional(),
	warning_threshold_reached: z.boolean().optional(),
	block_threshold_percent: money.optional(),
	block_threshold_reached: z.boolean().optional(),
	temporary_increase_allowed: z.boolean().optional(),
	temporary_increase_amount: money.optional(),
	temporary_increase_expires: z.coerce.date().optional(),
	temporary_increase_active: z.boolean().optional(),
	temporary_increase_reason: z.string().optional(),
	temporary_increase_approved_by: uuid.optional(),
	previous_limit: money.optional(),
	limit_increased_count: z.number().int().optional(),
	limit_decreased_count: z.number().int().optional(),
	last_limit_change_date: z.coerce.date().optional(),
	last_limit_change_reason: z.string().optional(),
	limit_history: z.record(z.unknown()).optional(),
	payment_terms: z.string().optional(),
	payment_terms_days: z.number().int().optional(),
	risk_level: z.string().optional(),
	risk_score: z.number().int().optional(),
	credit_score: z.number().int().optional(),
	credit_check_performed: z.boolean().optional(),
	credit_check_date: z.coerce.date().optional(),
	credit_check_agency: z.string().optional(),
	credit_check_reference: z.string().optional(),
	credit_check_valid_until: z.coerce.date().optional(),
	annual_revenue: money.optional(),
	years_in_business: z.number().int().optional(),
	duns_number: z.string().optional(),
	tax_id: z.string().optional(),
	trade_references_count: z.number().int().optional(),
	trade_references: z.record(z.unknown()).optional(),
	bank_references_count: z.number().int().optional(),
	bank_references: z.record(z.unknown()).optional(),
	has_guarantee: z.boolean().optional(),
	guarantee_type: z.string().optional(),
	guarantor_name: z.string().optional(),
	guarantor_contact: z.string().optional(),
	guarantee_amount: money.optional(),
	guarantee_expiry_date: z.coerce.date().optional(),
	security_deposit_required: z.boolean().optional(),
	security_deposit_amount: money.optional(),
	security_deposit_held: money.optional(),
	security_deposit_refundable: z.boolean().optional(),
	credit_card_on_file: z.boolean().optional(),
	credit_card_token: z.string().optional(),
	credit_card_last_four: z.string().optional(),
	credit_card_expiry_date: z.coerce.date().optional(),
	total_transactions: z.number().int().optional(),
	total_amount_transacted: money.optional(),
	on_time_payment_count: z.number().int().optional(),
	late_payment_count: z.number().int().optional(),
	on_time_payment_percent: money.optional(),
	average_days_to_pay: money.optional(),
	longest_overdue_days: z.number().int().optional(),
	last_transaction_date: z.coerce.date().optional(),
	last_payment_date: z.coerce.date().optional(),
	current_outstanding: money.optional(),
	overdue_amount: money.optional(),
	longest_outstanding_days: z.number().int().optional(),
	limit_exceeded_count: z.number().int().optional(),
	last_limit_exceeded_date: z.coerce.date().optional(),
	requires_review: z.boolean().optional(),
	review_frequency_days: z.number().int().optional(),
	last_review_date: z.coerce.date().optional(),
	next_review_date: z.coerce.date().optional(),
	reviewed_by: uuid.optional(),
	review_notes: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	approval_notes: z.string().optional(),
	approval_level: z.string().optional(),
	suspended: z.boolean().optional(),
	suspension_reason: z.string().optional(),
	suspended_at: z.coerce.date().optional(),
	suspended_by: uuid.optional(),
	blocked: z.boolean().optional(),
	block_reason: z.string().optional(),
	blocked_at: z.coerce.date().optional(),
	blocked_by: uuid.optional(),
	alert_enabled: z.boolean().optional(),
	alert_threshold_percent: money.optional(),
	alert_recipients: z.array(z.string()).optional(),
	last_alert_sent_at: z.coerce.date().optional(),
	alert_count: z.number().int().optional(),
	restrictions: z.string().optional(),
	requires_prepayment: z.boolean().optional(),
	max_transaction_amount: money.optional(),
	allowed_services: z.array(z.string()).optional(),
	restricted_services: z.array(z.string()).optional(),
	has_documentation: z.boolean().optional(),
	documentation_urls: z.array(z.string()).optional(),
	credit_application_url: z.string().optional(),
	signed_agreement_url: z.string().optional(),
	billing_contact_name: z.string().optional(),
	billing_contact_email: z.string().optional(),
	billing_contact_phone: z.string().optional(),
	billing_address: z.string().optional(),
	relationship_start_date: z.coerce.date().optional(),
	customer_since_years: z.number().int().optional(),
	relationship_manager_id: uuid.optional(),
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

export type CreditLimits = z.infer<typeof CreditLimitsSchema>;

/**
 * Schema for creating a new credit limits
 */
export const CreateCreditLimitsSchema = CreditLimitsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateCreditLimits = z.infer<typeof CreateCreditLimitsSchema>;

/**
 * Schema for updating a credit limits
 */
export const UpdateCreditLimitsSchema = CreditLimitsSchema.partial();

export type UpdateCreditLimits = z.infer<typeof UpdateCreditLimitsSchema>;
