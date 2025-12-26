/**
 * FinancialClosures Schema
 * @table financial_closures
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete FinancialClosures schema
 */
export const FinancialClosuresSchema = z.object({
	closure_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	closure_number: z.string(),
	closure_name: z.string(),
	closure_type: z.string(),
	period_start_date: z.coerce.date(),
	period_end_date: z.coerce.date(),
	fiscal_year: z.number().int().optional(),
	fiscal_month: z.number().int().optional(),
	fiscal_quarter: z.number().int().optional(),
	fiscal_week: z.number().int().optional(),
	business_date: z.coerce.date(),
	closure_status: z.string().optional(),
	is_closed: z.boolean().optional(),
	is_final: z.boolean().optional(),
	closure_started_at: z.coerce.date().optional(),
	closure_completed_at: z.coerce.date().optional(),
	closure_duration_minutes: z.number().int().optional(),
	total_room_revenue: money.optional(),
	total_food_beverage_revenue: money.optional(),
	total_service_revenue: money.optional(),
	total_other_revenue: money.optional(),
	total_gross_revenue: money,
	total_discounts: money.optional(),
	total_refunds: money.optional(),
	total_adjustments: money.optional(),
	total_net_revenue: money,
	total_taxes: money.optional(),
	total_service_charges: money.optional(),
	total_cash_payments: money.optional(),
	total_card_payments: money.optional(),
	total_bank_transfer_payments: money.optional(),
	total_other_payments: money.optional(),
	total_payments_received: money,
	accounts_receivable: money.optional(),
	deposits_held: money.optional(),
	prepayments: money.optional(),
	total_reservations: z.number().int().optional(),
	total_checkins: z.number().int().optional(),
	total_checkouts: z.number().int().optional(),
	total_cancellations: z.number().int().optional(),
	total_no_shows: z.number().int().optional(),
	total_transactions: z.number().int().optional(),
	total_invoices: z.number().int().optional(),
	total_payments: z.number().int().optional(),
	total_refund_transactions: z.number().int().optional(),
	available_rooms: z.number().int().optional(),
	occupied_rooms: z.number().int().optional(),
	out_of_order_rooms: z.number().int().optional(),
	occupancy_percent: money.optional(),
	adr: money.optional(),
	revpar: money.optional(),
	requires_reconciliation: z.boolean().optional(),
	is_reconciled: z.boolean().optional(),
	reconciliation_status: z.string().optional(),
	expected_cash: money.optional(),
	actual_cash: money.optional(),
	cash_variance: money.optional(),
	cash_variance_percent: money.optional(),
	expected_card_amount: money.optional(),
	actual_card_amount: money.optional(),
	card_variance: money.optional(),
	expected_total: money.optional(),
	actual_total: money.optional(),
	total_variance: money.optional(),
	variance_percent: money.optional(),
	has_variances: z.boolean().optional(),
	has_material_variances: z.boolean().optional(),
	variance_threshold_amount: money.optional(),
	variance_threshold_percent: money.optional(),
	variance_reasons: z.string().optional(),
	variance_details: z.record(z.unknown()).optional(),
	bank_deposit_amount: money.optional(),
	bank_deposit_date: z.coerce.date().optional(),
	bank_deposit_reference: z.string().optional(),
	bank_reconciled: z.boolean().optional(),
	total_till_sessions: z.number().int().optional(),
	till_sessions_closed: z.number().int().optional(),
	till_sessions_reconciled: z.number().int().optional(),
	unposted_charges_count: z.number().int().optional(),
	unposted_charges_amount: money.optional(),
	pending_payments_count: z.number().int().optional(),
	pending_payments_amount: money.optional(),
	unapplied_deposits_count: z.number().int().optional(),
	unapplied_deposits_amount: money.optional(),
	has_exceptions: z.boolean().optional(),
	exception_count: z.number().int().optional(),
	exceptions: z.record(z.unknown()).optional(),
	adjustment_count: z.number().int().optional(),
	adjustments: z.record(z.unknown()).optional(),
	gl_posted: z.boolean().optional(),
	gl_posted_at: z.coerce.date().optional(),
	gl_posted_by: uuid.optional(),
	gl_batch_number: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	approval_notes: z.string().optional(),
	reviewed_by: uuid.optional(),
	reviewed_at: z.coerce.date().optional(),
	review_notes: z.string().optional(),
	verified_by: uuid.optional(),
	verified_at: z.coerce.date().optional(),
	verification_notes: z.string().optional(),
	auditor_reviewed: z.boolean().optional(),
	audited_by: uuid.optional(),
	audited_at: z.coerce.date().optional(),
	audit_findings: z.string().optional(),
	reports_generated: z.boolean().optional(),
	report_urls: z.array(z.string()).optional(),
	notifications_sent: z.boolean().optional(),
	notification_recipients: z.array(z.string()).optional(),
	previous_closure_id: uuid.optional(),
	revenue_growth_percent: money.optional(),
	occupancy_change_percent: money.optional(),
	can_reopen: z.boolean().optional(),
	reopened: z.boolean().optional(),
	reopened_at: z.coerce.date().optional(),
	reopened_by: uuid.optional(),
	reopening_reason: z.string().optional(),
	reopen_count: z.number().int().optional(),
	last_reopened_at: z.coerce.date().optional(),
	period_locked: z.boolean().optional(),
	locked_at: z.coerce.date().optional(),
	locked_by: uuid.optional(),
	unlock_requires_authorization: z.boolean().optional(),
	checklist_items: z.record(z.unknown()).optional(),
	checklist_completed: z.boolean().optional(),
	auto_closed: z.boolean().optional(),
	manual_intervention_required: z.boolean().optional(),
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

export type FinancialClosures = z.infer<typeof FinancialClosuresSchema>;

/**
 * Schema for creating a new financial closures
 */
export const CreateFinancialClosuresSchema = FinancialClosuresSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateFinancialClosures = z.infer<
	typeof CreateFinancialClosuresSchema
>;

/**
 * Schema for updating a financial closures
 */
export const UpdateFinancialClosuresSchema = FinancialClosuresSchema.partial();

export type UpdateFinancialClosures = z.infer<
	typeof UpdateFinancialClosuresSchema
>;
