/**
 * DEV DOC
 * Module: schemas/04-financial/cashier-sessions.ts
 * Description: CashierSessions Schema
 * Table: cashier_sessions
 * Category: 04-financial
 * Primary exports: CashierSessionsSchema, CreateCashierSessionsSchema, UpdateCashierSessionsSchema
 * @table cashier_sessions
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * CashierSessions Schema
 * @table cashier_sessions
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete CashierSessions schema
 */
export const CashierSessionsSchema = z.object({
	session_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	session_number: z.string(),
	session_name: z.string().optional(),
	cashier_id: uuid,
	cashier_name: z.string().optional(),
	terminal_id: z.string().optional(),
	terminal_name: z.string().optional(),
	till_id: z.string().optional(),
	register_id: z.string().optional(),
	location: z.string().optional(),
	session_status: z.string().optional(),
	opened_at: z.coerce.date(),
	closed_at: z.coerce.date().optional(),
	session_duration_minutes: z.number().int().optional(),
	business_date: z.coerce.date(),
	shift_type: z.string().optional(),
	opening_float_declared: money,
	opening_float_counted: money.optional(),
	opening_float_variance: money.optional(),
	base_currency: z.string().optional(),
	multi_currency_enabled: z.boolean().optional(),
	total_transactions: z.number().int().optional(),
	cash_transactions: z.number().int().optional(),
	card_transactions: z.number().int().optional(),
	other_transactions: z.number().int().optional(),
	refund_transactions: z.number().int().optional(),
	void_transactions: z.number().int().optional(),
	total_cash_received: money.optional(),
	total_card_received: money.optional(),
	total_bank_transfer: money.optional(),
	total_mobile_payment: money.optional(),
	total_other_payments: money.optional(),
	total_revenue: money.optional(),
	total_refunds: money.optional(),
	cash_refunds: money.optional(),
	card_refunds: money.optional(),
	total_voids: money.optional(),
	void_count: z.number().int().optional(),
	net_revenue: money.optional(),
	cash_in: money.optional(),
	cash_out: money.optional(),
	cash_deposits: z.number().int().optional(),
	cash_deposits_amount: money.optional(),
	cash_withdrawals: z.number().int().optional(),
	cash_withdrawals_amount: money.optional(),
	expected_cash_balance: money.optional(),
	expected_total_balance: money.optional(),
	closing_cash_declared: money.optional(),
	closing_cash_counted: money.optional(),
	closing_total_counted: money.optional(),
	cash_breakdown: z.record(z.unknown()).optional(),
	cash_variance: money.optional(),
	cash_variance_percent: money.optional(),
	total_variance: money.optional(),
	variance_reason: z.string().optional(),
	has_variance: z.boolean().optional(),
	has_material_variance: z.boolean().optional(),
	variance_threshold: money.optional(),
	card_payment_breakdown: z.record(z.unknown()).optional(),
	card_processing_fees: money.optional(),
	bank_deposit_prepared: z.boolean().optional(),
	bank_deposit_amount: money.optional(),
	bank_deposit_date: z.coerce.date().optional(),
	bank_deposit_slip_number: z.string().optional(),
	bank_deposited: z.boolean().optional(),
	requires_reconciliation: z.boolean().optional(),
	reconciled: z.boolean().optional(),
	reconciled_at: z.coerce.date().optional(),
	reconciled_by: uuid.optional(),
	reconciliation_notes: z.string().optional(),
	has_adjustments: z.boolean().optional(),
	adjustment_count: z.number().int().optional(),
	adjustment_amount: money.optional(),
	adjustments: z.record(z.unknown()).optional(),
	has_exceptions: z.boolean().optional(),
	exception_count: z.number().int().optional(),
	exceptions: z.record(z.unknown()).optional(),
	supervisor_override_count: z.number().int().optional(),
	supervisor_overrides: z.record(z.unknown()).optional(),
	last_audit_at: z.coerce.date().optional(),
	audited_by: uuid.optional(),
	audit_findings: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	reviewed_by: uuid.optional(),
	reviewed_at: z.coerce.date().optional(),
	review_notes: z.string().optional(),
	has_discrepancy: z.boolean().optional(),
	discrepancy_investigated: z.boolean().optional(),
	investigation_notes: z.string().optional(),
	investigated_by: uuid.optional(),
	payment_methods_summary: z.record(z.unknown()).optional(),
	foreign_currency_transactions: z.number().int().optional(),
	exchange_rates: z.record(z.unknown()).optional(),
	petty_cash_transactions: z.number().int().optional(),
	petty_cash_out: money.optional(),
	tips_collected: money.optional(),
	tips_distributed: money.optional(),
	tips_outstanding: money.optional(),
	vouchers_redeemed: z.number().int().optional(),
	vouchers_amount: money.optional(),
	gift_cards_sold: z.number().int().optional(),
	gift_cards_sold_amount: money.optional(),
	gift_cards_redeemed: z.number().int().optional(),
	gift_cards_redeemed_amount: money.optional(),
	room_revenue: money.optional(),
	food_beverage_revenue: money.optional(),
	service_revenue: money.optional(),
	other_revenue: money.optional(),
	taxes_collected: money.optional(),
	reports_generated: z.boolean().optional(),
	report_urls: z.array(z.string()).optional(),
	previous_session_id: uuid.optional(),
	next_session_id: uuid.optional(),
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

export type CashierSessions = z.infer<typeof CashierSessionsSchema>;

/**
 * Schema for creating a new cashier sessions
 */
export const CreateCashierSessionsSchema = CashierSessionsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateCashierSessions = z.infer<typeof CreateCashierSessionsSchema>;

/**
 * Schema for updating a cashier sessions
 */
export const UpdateCashierSessionsSchema = CashierSessionsSchema.partial();

export type UpdateCashierSessions = z.infer<typeof UpdateCashierSessionsSchema>;
