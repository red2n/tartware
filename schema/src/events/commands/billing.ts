/**
 * DEV DOC
 * Module: events/commands/billing.ts
 * Description: Billing command schemas for payments, invoices, folios, commissions, AR, cashier, and dynamic pricing
 * Primary exports: BillingPaymentCaptureCommandSchema, BillingChargePostCommandSchema, BillingNightAuditCommandSchema, CommissionCalculateCommandSchema, BillingArPostCommandSchema, BillingCashierOpenCommandSchema, BillingPricingEvaluateCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

import { FolioTypeEnum, PaymentMethodEnum } from "../../shared/enums.js";

export const BillingPaymentCaptureCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	payment_method: PaymentMethodEnum,
	gateway: z
		.object({
			name: z.string().max(100).optional(),
			reference: z.string().max(150).optional(),
			response: z.record(z.unknown()).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type BillingPaymentCaptureCommand = z.infer<
	typeof BillingPaymentCaptureCommandSchema
>;

export const BillingPaymentRefundCommandSchema = z
	.object({
		payment_id: z.string().uuid().optional(),
		payment_reference: z.string().trim().max(100).optional(),
		property_id: z.string().uuid(),
		reservation_id: z.string().uuid(),
		guest_id: z.string().uuid(),
		amount: z.coerce.number().positive(),
		currency: z.string().length(3).optional(),
		reason: z.string().max(500).optional(),
		refund_reference: z.string().trim().max(120).optional(),
		payment_method: PaymentMethodEnum.optional(),
	})
	.refine(
		(value) => Boolean(value.payment_id || value.payment_reference),
		"payment_id or payment_reference is required",
	);

export type BillingPaymentRefundCommand = z.infer<
	typeof BillingPaymentRefundCommandSchema
>;

export const BillingInvoiceCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
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

export const BillingChargePostCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	charge_code: z.string().max(50).default("MISC"),
	department_code: z.string().max(20).optional(),
	posting_type: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
	quantity: z.coerce.number().int().positive().default(1),
	description: z.string().max(2000).optional(),
	posted_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingChargePostCommand = z.infer<
	typeof BillingChargePostCommandSchema
>;

export const BillingPaymentApplyCommandSchema = z
	.object({
		payment_id: z.string().uuid(),
		invoice_id: z.string().uuid().optional(),
		reservation_id: z.string().uuid().optional(),
		amount: z.coerce.number().positive().optional(),
		notes: z.string().max(2000).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.invoice_id || value.reservation_id),
		"invoice_id or reservation_id is required",
	);

export type BillingPaymentApplyCommand = z.infer<
	typeof BillingPaymentApplyCommandSchema
>;

export const BillingFolioTransferCommandSchema = z.object({
	from_reservation_id: z.string().uuid(),
	to_reservation_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioTransferCommand = z.infer<
	typeof BillingFolioTransferCommandSchema
>;

/**
 * Transfer a specific charge posting from one folio to another.
 * Creates TRANSFER-type audit records on both folios.
 */
export const BillingChargeTransferCommandSchema = z
	.object({
		posting_id: z.string().uuid(),
		to_folio_id: z.string().uuid().optional(),
		to_reservation_id: z.string().uuid().optional(),
		reason: z.string().max(500).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(v) => Boolean(v.to_folio_id || v.to_reservation_id),
		"to_folio_id or to_reservation_id is required",
	);

export type BillingChargeTransferCommand = z.infer<
	typeof BillingChargeTransferCommandSchema
>;

/**
 * Split a charge across multiple folios.
 * Creates partial-amount postings on each target folio.
 */
export const BillingFolioSplitCommandSchema = z.object({
	posting_id: z.string().uuid(),
	splits: z
		.array(
			z.object({
				folio_id: z.string().uuid().optional(),
				reservation_id: z.string().uuid().optional(),
				amount: z.coerce.number().positive(),
				description: z.string().max(500).optional(),
			}),
		)
		.min(2, "At least two split targets are required"),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioSplitCommand = z.infer<
	typeof BillingFolioSplitCommandSchema
>;

/**
 * Pre-authorize a payment hold (AUTHORIZE) without capturing funds.
 * Used for deposit guarantees at check-in.
 */
export const BillingPaymentAuthorizeCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	payment_method: PaymentMethodEnum,
	gateway: z
		.object({
			name: z.string().max(100).optional(),
			reference: z.string().max(150).optional(),
			response: z.record(z.unknown()).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPaymentAuthorizeCommand = z.infer<
	typeof BillingPaymentAuthorizeCommandSchema
>;

/**
 * Increment an existing pre-authorization by a specified amount.
 * Used when a guest extends their stay or incurs additional charges
 * that exceed the original authorization hold.
 */
export const BillingPaymentIncrementAuthCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	additional_amount: z.coerce.number().positive(),
	reason: z.string().max(500).optional(),
	gateway: z
		.object({
			name: z.string().max(100).optional(),
			reference: z.string().max(150).optional(),
			response: z.record(z.unknown()).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPaymentIncrementAuthCommand = z.infer<
	typeof BillingPaymentIncrementAuthCommandSchema
>;

/**
 * Execute night audit: post room charges for in-house guests,
 * mark no-shows, and advance the business date.
 */
export const BillingNightAuditCommandSchema = z.object({
	property_id: z.string().uuid(),
	business_date: z.string().optional(),
	post_room_charges: z.boolean().optional(),
	post_package_charges: z.boolean().optional(),
	post_ota_commissions: z.boolean().optional(),
	use_compound_taxes: z.boolean().optional(),
	mark_no_shows: z.boolean().optional(),
	advance_date: z.boolean().optional(),
	lock_postings: z.boolean().optional(),
	generate_trial_balance: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingNightAuditCommand = z.infer<
	typeof BillingNightAuditCommandSchema
>;

/**
 * Manually advance the business date without running the full night audit.
 * Skips charge posting and reconciliation — just advances the date.
 * Useful for correcting date issues or initial property setup.
 */
export const BillingDateRollManualCommandSchema = z.object({
	property_id: z.string().uuid(),
	target_date: z.string().date().optional(),
	reason: z.string().max(2000),
	skip_validation: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingDateRollManualCommand = z.infer<
	typeof BillingDateRollManualCommandSchema
>;

/**
 * Close/settle a folio. Sets folio_status to CLOSED or SETTLED
 * depending on balance. Zero balance → SETTLED, otherwise CLOSED.
 */
export const BillingFolioCloseCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	close_reason: z.string().max(500).optional(),
	force: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioCloseCommand = z.infer<
	typeof BillingFolioCloseCommandSchema
>;

/**
 * Void a previously authorized payment.
 * Only AUTHORIZED payments can be voided.
 */
export const BillingPaymentVoidCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPaymentVoidCommand = z.infer<
	typeof BillingPaymentVoidCommandSchema
>;

/**
 * Void a charge posting on a folio.
 * Creates a reversal VOID posting and adjusts folio balance.
 */
export const BillingChargeVoidCommandSchema = z.object({
	posting_id: z.string().uuid(),
	void_reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingChargeVoidCommand = z.infer<
	typeof BillingChargeVoidCommandSchema
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

// ─── Commission Commands ─────────────────────────────────────────────────────

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

// ─── Accounts Receivable Command Schemas ─────────────────────────────────────

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

// ─── Cashier Session Commands ────────────────────────────────────────────────

/**
 * Open a new cashier session (shift start).
 */
export const BillingCashierOpenCommandSchema = z.object({
	property_id: z.string().uuid(),
	cashier_id: z.string().uuid(),
	cashier_name: z.string().max(200),
	terminal_id: z.string().max(50).optional(),
	shift_type: z
		.enum(["morning", "afternoon", "evening", "night", "full_day", "custom"])
		.default("full_day"),
	opening_float: z.coerce.number().nonnegative().default(0),
	business_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCashierOpenCommand = z.infer<
	typeof BillingCashierOpenCommandSchema
>;

/**
 * Close a cashier session (shift end) with reconciliation.
 */
export const BillingCashierCloseCommandSchema = z.object({
	session_id: z.string().uuid(),
	closing_cash_declared: z.coerce.number().nonnegative(),
	closing_cash_counted: z.coerce.number().nonnegative(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCashierCloseCommand = z.infer<
	typeof BillingCashierCloseCommandSchema
>;

// ─── Dynamic Pricing Commands ─────────────────────────────────────────────────

/**
 * Evaluate active pricing rules for a given property/room type/date.
 * Loads applicable pricing_rules, evaluates conditions against provided
 * context (occupancy, demand, lead time, etc.), applies adjustments
 * with caps, and returns the recommended adjusted rate.
 */
export const BillingPricingEvaluateCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid(),
	/** The base rate to adjust (from rate table). */
	base_rate: z.coerce.number().nonnegative(),
	/** Target date for pricing evaluation. */
	stay_date: z.coerce.date(),
	/** Current property occupancy percentage (0-100). */
	occupancy_percent: z.coerce.number().min(0).max(100).optional(),
	/** Demand level for the day: very_low to exceptional. */
	demand_level: z
		.enum(["very_low", "low", "moderate", "high", "very_high", "exceptional"])
		.optional(),
	/** Days until arrival for advance-purchase / last-minute rules. */
	days_until_arrival: z.coerce.number().int().nonnegative().optional(),
	/** Guest's requested length of stay (nights). */
	length_of_stay: z.coerce.number().int().positive().optional(),
	/** Day of week (0=Sunday to 6=Saturday). */
	day_of_week: z.coerce.number().int().min(0).max(6).optional(),
	/** Booking channel for channel-based rules. */
	channel: z.string().max(50).optional(),
	/** Market segment for segment-based rules. */
	segment: z.string().max(50).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPricingEvaluateCommand = z.infer<
	typeof BillingPricingEvaluateCommandSchema
>;

/**
 * Bulk generate rate recommendations for a property/date range.
 * Evaluates pricing rules across all room types and dates, then
 * writes results to rate_recommendations for revenue manager review.
 */
export const BillingPricingBulkRecommendCommandSchema = z.object({
	property_id: z.string().uuid(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	/** Only evaluate for specific room types (all if omitted). */
	room_type_ids: z.array(z.string().uuid()).optional(),
	dry_run: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingPricingBulkRecommendCommand = z.infer<
	typeof BillingPricingBulkRecommendCommandSchema
>;

// ─── Chargeback Commands ─────────────────────────────────────────────────────

/**
 * Record a processor-initiated chargeback against a completed payment.
 * Updates the refunds table with chargeback fields and adjusts folio balance.
 */
export const BillingChargebackRecordCommandSchema = z.object({
	property_id: z.string().uuid(),
	payment_reference: z.string().trim().min(3).max(100),
	chargeback_amount: z.coerce.number().positive(),
	chargeback_reason: z.string().max(200),
	chargeback_reference: z.string().max(100).optional(),
	chargeback_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingChargebackRecordCommand = z.infer<
	typeof BillingChargebackRecordCommandSchema
>;

// ─── Fiscal Period Commands ──────────────────────────────────────────────────

/**
 * Close a fiscal period, transitioning it from OPEN to SOFT_CLOSE.
 * Prevents new postings to journal entries for the period.
 */
export const BillingFiscalPeriodCloseCommandSchema = z.object({
	property_id: z.string().uuid(),
	period_id: z.string().uuid(),
	close_reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFiscalPeriodCloseCommand = z.infer<
	typeof BillingFiscalPeriodCloseCommandSchema
>;

/**
 * Lock a fiscal period, transitioning from SOFT_CLOSE to LOCKED.
 * Fully immutable — no postings, adjustments, or reversals allowed.
 */
export const BillingFiscalPeriodLockCommandSchema = z.object({
	property_id: z.string().uuid(),
	period_id: z.string().uuid(),
	approved_by: z.string().uuid().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFiscalPeriodLockCommand = z.infer<
	typeof BillingFiscalPeriodLockCommandSchema
>;

/**
 * Reopen a soft-closed fiscal period (cannot reopen LOCKED).
 */
export const BillingFiscalPeriodReopenCommandSchema = z.object({
	property_id: z.string().uuid(),
	period_id: z.string().uuid(),
	reason: z.string().max(500),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFiscalPeriodReopenCommand = z.infer<
	typeof BillingFiscalPeriodReopenCommandSchema
>;

// ─── Folio Window Commands ───────────────────────────────────────────────────

/**
 * Create a folio window for date-based split billing within a single stay.
 * E.g., "company pays Mon-Fri, guest pays Sat-Sun".
 */
export const BillingFolioWindowCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	folio_id: z.string().uuid(),
	window_start: z.coerce.date(),
	window_end: z.coerce.date(),
	billed_to: z.string().max(255),
	billed_to_type: z.enum(["GUEST", "CORPORATE", "TRAVEL_AGENT", "OTHER"]),
	notes: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioWindowCreateCommand = z.infer<
	typeof BillingFolioWindowCreateCommandSchema
>;

// ─── Tax Configuration Commands ──────────────────────────────────────────────

/**
 * Create a new tax configuration rule.
 */
export const BillingTaxConfigCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	tax_code: z.string().trim().min(1).max(50),
	tax_name: z.string().trim().min(1).max(255),
	tax_description: z.string().max(2000).optional(),
	tax_type: z.enum([
		"sales_tax",
		"vat",
		"gst",
		"occupancy_tax",
		"tourism_tax",
		"city_tax",
		"state_tax",
		"federal_tax",
		"resort_fee",
		"service_charge",
		"excise_tax",
		"customs_duty",
		"other",
	]),
	country_code: z.string().min(2).max(3),
	state_province: z.string().max(100).optional(),
	city: z.string().max(100).optional(),
	jurisdiction_name: z.string().max(200).optional(),
	jurisdiction_level: z
		.enum(["federal", "state", "county", "city", "local", "special"])
		.optional(),
	tax_rate: z.coerce.number().min(0).max(100),
	is_percentage: z.boolean().default(true),
	fixed_amount: z.coerce.number().nonnegative().optional(),
	effective_from: z.coerce.date(),
	effective_to: z.coerce.date().optional(),
	is_active: z.boolean().default(true),
	applies_to: z.array(z.string().max(100)).optional(),
	excluded_items: z.array(z.string().max(100)).optional(),
	is_compound_tax: z.boolean().default(false),
	compound_order: z.coerce.number().int().min(0).optional(),
	compound_on_tax_codes: z.array(z.string().max(50)).optional(),
	calculation_method: z
		.enum(["inclusive", "exclusive", "compound", "cascading", "additive", "tiered", "progressive", "flat", "custom"])
		.default("exclusive"),
	rounding_method: z
		.enum(["standard", "up", "down", "nearest", "none"])
		.default("standard"),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingTaxConfigCreateCommand = z.infer<
	typeof BillingTaxConfigCreateCommandSchema
>;

/**
 * Update an existing tax configuration rule.
 */
export const BillingTaxConfigUpdateCommandSchema = z.object({
	tax_config_id: z.string().uuid(),
	property_id: z.string().uuid(),
	tax_code: z.string().trim().min(1).max(50).optional(),
	tax_name: z.string().trim().min(1).max(255).optional(),
	tax_description: z.string().max(2000).optional(),
	tax_type: z
		.enum([
			"sales_tax",
			"vat",
			"gst",
			"occupancy_tax",
			"tourism_tax",
			"city_tax",
			"state_tax",
			"federal_tax",
			"resort_fee",
			"service_charge",
			"excise_tax",
			"customs_duty",
			"other",
		])
		.optional(),
	tax_rate: z.coerce.number().min(0).max(100).optional(),
	is_percentage: z.boolean().optional(),
	fixed_amount: z.coerce.number().nonnegative().optional(),
	effective_from: z.coerce.date().optional(),
	effective_to: z.coerce.date().optional(),
	is_active: z.boolean().optional(),
	applies_to: z.array(z.string().max(100)).optional(),
	excluded_items: z.array(z.string().max(100)).optional(),
	is_compound_tax: z.boolean().optional(),
	compound_order: z.coerce.number().int().min(0).optional(),
	compound_on_tax_codes: z.array(z.string().max(50)).optional(),
	calculation_method: z
		.enum(["inclusive", "exclusive", "compound", "cascading", "additive", "tiered", "progressive", "flat", "custom"])
		.optional(),
	rounding_method: z
		.enum(["standard", "up", "down", "nearest", "none"])
		.optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingTaxConfigUpdateCommand = z.infer<
	typeof BillingTaxConfigUpdateCommandSchema
>;

/**
 * Deactivate (soft-delete) a tax configuration.
 */
export const BillingTaxConfigDeleteCommandSchema = z.object({
	tax_config_id: z.string().uuid(),
	property_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingTaxConfigDeleteCommand = z.infer<
	typeof BillingTaxConfigDeleteCommandSchema
>;

// ─── Express Checkout Command ────────────────────────────────────────────────

/**
 * Express checkout: auto-settle zero-balance folios and update room status.
 * `send_folio_email` is an advisory flag reserved for downstream
 * notification integration and does not itself dispatch an email.
 */
export const BillingExpressCheckoutCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	folio_id: z.string().uuid().optional(),
	// Advisory flag for a future notification workflow.
	send_folio_email: z.boolean().default(true),
	skip_balance_check: z.boolean().default(false),
	notes: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingExpressCheckoutCommand = z.infer<
	typeof BillingExpressCheckoutCommandSchema
>;

// ─── Shift Handover Command ──────────────────────────────────────────────────

/**
 * Atomically close the current cashier session and open the next one,
 * recording cash count, open issues, and notes for the incoming shift.
 */
export const BillingCashierHandoverCommandSchema = z.object({
	/** Session being closed (outgoing cashier). */
	outgoing_session_id: z.string().uuid(),
	/** Cash declared by the outgoing cashier. */
	closing_cash_declared: z.coerce.number().nonnegative(),
	/** Cash physically counted during handover. */
	closing_cash_counted: z.coerce.number().nonnegative(),
	/** Notes from the outgoing shift about pending items, issues, etc. */
	handover_notes: z.string().max(4000).optional(),
	/** Incoming cashier details — used to open the next session. */
	incoming_cashier_id: z.string().uuid(),
	incoming_cashier_name: z.string().max(200),
	incoming_terminal_id: z.string().max(50).optional(),
	incoming_shift_type: z
		.enum(["morning", "afternoon", "evening", "night", "full_day", "custom"])
		.default("full_day"),
	/** Opening float for the incoming session (defaults to counted cash). */
	incoming_opening_float: z.coerce.number().nonnegative().optional(),
	property_id: z.string().uuid(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCashierHandoverCommand = z.infer<
	typeof BillingCashierHandoverCommandSchema
>;

// ─── Folio Create ───────────────────────────────────────────────────────

/**
 * Create a standalone folio (house account, city ledger, walk-in, incidental).
 * Industry standard: PMS systems support folios independent of reservations
 * for walk-in POS charges, company direct-bill, internal house accounts, etc.
 * reservation_id is optional — only required for GUEST-type folios.
 */
export const BillingFolioCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	folio_type: FolioTypeEnum,
	/** Required for GUEST folios, optional for others. */
	reservation_id: z.string().uuid().optional(),
	/** Guest or company contact. */
	guest_id: z.string().uuid().optional(),
	/** Descriptive label for the folio (e.g., "Acme Corp City Ledger"). */
	folio_name: z.string().max(200).optional(),
	/** Billing address for the folio. */
	billing_address: z.record(z.unknown()).optional(),
	/** Tax exemption reference, if applicable. */
	tax_exempt_id: z.string().max(100).optional(),
	currency: z.string().length(3).default("USD"),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingFolioCreateCommand = z.infer<
	typeof BillingFolioCreateCommandSchema
>;

// ─── Invoice Void ───────────────────────────────────────────────────────

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

// ─── Credit Note ────────────────────────────────────────────────────────

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
