/**
 * Billing command schemas — Operations domain
 * Covers night audit, date roll, GL, fiscal periods, no-show,
 * late checkout, cancellation penalty, and express checkout.
 * @category commands
 */

import { z } from "zod";

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
 * Rebuild the general ledger batch for a property business date using posted
 * billing source transactions. Safe to rerun for the same date.
 */
export const BillingLedgerPostCommandSchema = z.object({
	property_id: z.string().uuid(),
	business_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingLedgerPostCommand = z.infer<
	typeof BillingLedgerPostCommandSchema
>;

/**
 * Mark a GL batch as exported and record the export destination.
 * Used for ERP integration — stamps exported_at, sets batch_status = 'POSTED'.
 */
export const BillingGlBatchExportCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** Target GL batch to export; omit to auto-select REVIEW-status batch for the business date. */
	gl_batch_id: z.string().uuid().optional(),
	/** Business date to export; required when gl_batch_id is omitted. */
	business_date: z.coerce.date().optional(),
	/** Export format: USALI (default), CSV, XML, API. */
	export_format: z.enum(["USALI", "CSV", "XML", "API"]).default("USALI"),
	/** Optional URL where the export file was written (set by ERP integration layer). */
	export_file_url: z.string().url().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingGlBatchExportCommand = z.infer<typeof BillingGlBatchExportCommandSchema>;

/**
 * Close a fiscal period, transitioning it from OPEN to SOFT_CLOSE.
 * Prevents new postings to journal entries for the period.
 */
export const BillingFiscalPeriodCloseCommandSchema = z.object({
	property_id: z.string().uuid(),
	period_id: z.string().uuid(),
	close_reason: z.string().max(500).optional(),
	/**
	 * Caller must explicitly confirm that AR/GL balances reconcile before close.
	 * Prevents period close without completing the reconciliation checklist (BA §15 G-15).
	 */
	reconciliation_confirmed: z.boolean().optional(),
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

/**
 * Post a no-show penalty charge for a reservation that was not cancelled
 * and the guest did not arrive. Typically executed during night audit
 * for reservations that remain in RESERVED status past their expected
 * arrival time. The charge is posted to the first-night room rate.
 */
export const BillingNoShowChargeCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	/** Override charge amount — defaults to first-night room rate if omitted. */
	charge_amount: z.coerce.number().positive().optional(),
	currency: z.string().length(3).optional(),
	/** Reason code for audit: typically "NO_SHOW_POLICY". */
	reason_code: z.string().max(100).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingNoShowChargeCommand = z.infer<
	typeof BillingNoShowChargeCommandSchema
>;

/**
 * Post a late checkout fee. The fee tier is calculated from the checkout
 * time against the property's late checkout policy:
 *   ≤ 2h overdue → 50% of one night
 *   > 2h overdue → 100% of one night (or full day rate)
 * Requires the reservation to be in CHECKED_IN status.
 */
export const BillingLateCheckoutChargeCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	/** Actual checkout ISO 8601 datetime; used to calculate tier. */
	actual_checkout_time: z.string().datetime({ offset: true }),
	/** Standard checkout time (HH:MM); defaults to property policy if omitted. */
	standard_checkout_time: z.string().max(10).optional(),
	/** Override calculated fee — skips tier lookup. */
	override_amount: z.coerce.number().positive().optional(),
	currency: z.string().length(3).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingLateCheckoutChargeCommand = z.infer<
	typeof BillingLateCheckoutChargeCommandSchema
>;

/**
 * Apply a cancellation penalty charge to a reservation's folio.
 * Looks up the applicable cancellation policy from the reservation's
 * rate plan; the penalty_amount_override bypasses the policy lookup.
 * The charge is posted with charge_code="CANCEL_PENALTY".
 */
export const BillingCancellationPenaltyCommandSchema = z.object({
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	/** Override the policy-derived penalty — useful for negotiated amounts. */
	penalty_amount_override: z.coerce.number().positive().optional(),
	currency: z.string().length(3).optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCancellationPenaltyCommand = z.infer<
	typeof BillingCancellationPenaltyCommandSchema
>;

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
