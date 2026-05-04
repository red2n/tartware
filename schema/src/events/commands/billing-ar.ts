/**
 * Billing command schemas — Accounts Receivable + Commission domain
 * Covers AR post, apply, age, write-off, and commission lifecycle.
 * @category commands
 */

import { z } from "zod";

// ─── Accounts Receivable ─────────────────────────────────────────────────────

/**
 * Post an AR entry (typically on checkout for direct-bill guests).
 */
export const BillingArPostCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	folio_id: z.string().uuid().optional(),
	account_type: z.enum([
		"guest",
		"corporate",
		"travel_agent",
		"group",
		"direct_bill",
		"city_ledger",
		"other",
	]),
	account_id: z.string().uuid(),
	account_name: z.string().max(255),
	amount: z.number().positive(),
	payment_terms: z.string().max(50).default("net_30"),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArPostCommand = z.infer<typeof BillingArPostCommandSchema>;

/**
 * Apply a payment against an outstanding AR balance.
 */
export const BillingArApplyPaymentCommandSchema = z.object({
	ar_id: z.string().uuid(),
	amount: z.number().positive(),
	payment_reference: z.string().max(100),
	payment_method: z.string().max(50).optional(),
	payment_date: z.coerce.date().optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArApplyPaymentCommand = z.infer<
	typeof BillingArApplyPaymentCommandSchema
>;

/**
 * Recalculate aging buckets for all open AR entries.
 */
export const BillingArAgeCommandSchema = z.object({
	property_id: z.string().uuid(),
	as_of_date: z.coerce.date().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArAgeCommand = z.infer<typeof BillingArAgeCommandSchema>;

/**
 * Write off an uncollectible AR entry.
 */
export const BillingArWriteOffCommandSchema = z.object({
	ar_id: z.string().uuid(),
	write_off_amount: z.number().positive(),
	reason: z.string().max(2000),
	approved_by: z.string().uuid().optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingArWriteOffCommand = z.infer<
	typeof BillingArWriteOffCommandSchema
>;

// ─── Commission ───────────────────────────────────────────────────────────────

/**
 * Calculate and record commission for a reservation.
 * Typically triggered on checkout when a travel_agent_id or booking_source
 * with commission config is present.
 */
export const CommissionCalculateCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	travel_agent_id: z.string().uuid().optional(),
	booking_source_id: z.string().uuid().optional(),
	room_revenue: z.coerce.number().nonnegative(),
	total_revenue: z.coerce.number().nonnegative(),
	nights: z.coerce.number().int().positive(),
	currency: z.string().length(3).default("USD"),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionCalculateCommand = z.infer<
	typeof CommissionCalculateCommandSchema
>;

/**
 * Approve a pending commission for payout.
 */
export const CommissionApproveCommandSchema = z.object({
	commission_id: z.string().uuid(),
	approved_by: z.string().uuid(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionApproveCommand = z.infer<
	typeof CommissionApproveCommandSchema
>;

/**
 * Mark a commission as paid.
 */
export const CommissionMarkPaidCommandSchema = z.object({
	commission_id: z.string().uuid(),
	payment_reference: z.string().max(100),
	payment_date: z.coerce.date().optional(),
	payment_method: z.string().max(50).optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionMarkPaidCommand = z.infer<
	typeof CommissionMarkPaidCommandSchema
>;

/**
 * Generate a periodic commission statement for an agent/company.
 */
export const CommissionStatementGenerateCommandSchema = z.object({
	property_id: z.string().uuid(),
	company_id: z.string().uuid().optional(),
	agent_id: z.string().uuid().optional(),
	period_start: z.coerce.date(),
	period_end: z.coerce.date(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type CommissionStatementGenerateCommand = z.infer<
	typeof CommissionStatementGenerateCommandSchema
>;
