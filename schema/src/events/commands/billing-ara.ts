/**
 * ARA (Accounts Receivable Analyst) command schemas — Sprint 1
 * AR Accounts + City Ledger foundation
 *
 * AR accounts represent credit-extended entities (corporate clients, travel agencies,
 * group masters). The city ledger holds unsettled post-departure charges transferred
 * from guest folios.
 *
 * @category commands
 */

import { z } from "zod";

// ─── AR Account management ────────────────────────────────────────────────────

const PaymentTermsEnum = z.enum(["NET30", "NET45", "NET60", "DUE_ON_RECEIPT"]);

/**
 * Create a new AR account for a company or travel agent.
 *
 * An AR account is required before any city ledger transfer can be made.
 * Extends the existing `billing.ar.create_account` concept.
 */
export const ArAccountCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	company_id: z.string().uuid(),
	company_name: z.string().min(1).max(255),
	contact_name: z.string().max(255).optional(),
	contact_email: z.string().email().max(255).optional(),
	billing_address: z.string().max(2000).optional(),
	credit_limit: z.coerce.number().nonnegative(),
	payment_terms: PaymentTermsEnum.default("NET30"),
	currency: z.string().length(3).default("USD"),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArAccountCreateCommand = z.infer<typeof ArAccountCreateCommandSchema>;

/**
 * Update credit limit and/or payment terms on an existing AR account.
 */
export const ArAccountUpdateTermsCommandSchema = z.object({
	ar_account_id: z.string().uuid(),
	property_id: z.string().uuid(),
	credit_limit: z.coerce.number().nonnegative().optional(),
	payment_terms: PaymentTermsEnum.optional(),
	status: z.enum(["ACTIVE", "SUSPENDED", "COLLECTIONS"]).optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArAccountUpdateTermsCommand = z.infer<
	typeof ArAccountUpdateTermsCommandSchema
>;

// ─── City Ledger transfers ────────────────────────────────────────────────────

/**
 * Transfer a folio's outstanding balance to the city ledger.
 *
 * Fires automatically when a guest checks out with a direct-bill routing rule.
 * Pre-checks credit limit; blocks transfer if limit would be exceeded.
 *
 * GL treatment: DR City Ledger (AR) / CR Guest Ledger (folio).
 * Idempotent: deduplicated by (folio_id, ar_account_id).
 */
export const ArCityLedgerTransferCommandSchema = z.object({
	property_id: z.string().uuid(),
	ar_account_id: z.string().uuid(),
	folio_id: z.string().uuid(),
	reservation_id: z.string().uuid().optional(),
	invoice_id: z.string().uuid().optional(),
	/** Amount to transfer. Defaults to full outstanding folio balance. */
	amount: z.coerce.number().positive().optional(),
	currency: z.string().length(3).default("USD"),
	/** ISO-8601 date the transfer is effective. Defaults to business date. */
	transfer_date: z.coerce.date().optional(),
	/** Due date based on AR account payment terms. Computed from payment_terms if omitted. */
	due_date: z.coerce.date().optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArCityLedgerTransferCommand = z.infer<
	typeof ArCityLedgerTransferCommandSchema
>;

/**
 * Write off a bad-debt city ledger entry.
 *
 * GL treatment: DR Bad Debt Expense / CR City Ledger (AR).
 * Sets city ledger entry status to WRITTEN_OFF.
 * Requires MANAGER role.
 */
export const ArCityLedgerWriteOffCommandSchema = z.object({
	property_id: z.string().uuid(),
	city_ledger_id: z.string().uuid(),
	/** Amount to write off. Defaults to full outstanding_amount. */
	amount: z.coerce.number().positive().optional(),
	reason: z.string().min(10).max(2000),
	approved_by: z.string().uuid().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArCityLedgerWriteOffCommand = z.infer<
	typeof ArCityLedgerWriteOffCommandSchema
>;

// ─── Aging & Dunning ──────────────────────────────────────────────────────────

/**
 * Compute aging snapshot for all AR accounts with outstanding city ledger balances.
 *
 * Triggered nightly by `night_audit.advance_business_date`.
 * Writes/overwrites ar_aging_snapshots for the given snapshot_date.
 * Also fires `ar.dunning.trigger` for any accounts crossing a bucket threshold.
 */
export const ArAgingComputeCommandSchema = z.object({
	property_id: z.string().uuid(),
	snapshot_date: z.coerce.date().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArAgingComputeCommand = z.infer<typeof ArAgingComputeCommandSchema>;

/**
 * Trigger a dunning action for an AR account that has crossed an aging threshold.
 * Fired automatically by `ar.aging.compute`; can also be fired manually.
 */
export const ArDunningTriggerCommandSchema = z.object({
	property_id: z.string().uuid(),
	ar_account_id: z.string().uuid(),
	bucket: z.enum(["30", "60", "90", "90+"]),
	/** Override the default action for this bucket level. */
	action_override: z
		.enum(["EMAIL", "STATEMENT", "FORMAL_NOTICE", "COLLECTIONS"])
		.optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArDunningTriggerCommand = z.infer<
	typeof ArDunningTriggerCommandSchema
>;

/**
 * Suppress dunning for an AR account (e.g., active payment negotiation).
 */
export const ArDunningSuppressCommandSchema = z.object({
	property_id: z.string().uuid(),
	ar_account_id: z.string().uuid(),
	reason: z.string().max(1000).optional(),
	/** How long to suppress (days). Defaults to 30. */
	suppress_days: z.number().int().positive().default(30),
	idempotency_key: z.string().max(120).optional(),
});

export type ArDunningSuppressCommand = z.infer<
	typeof ArDunningSuppressCommandSchema
>;

// ─── Cash Application ─────────────────────────────────────────────────────────

/**
 * Apply an incoming payment against one or more city ledger entries.
 *
 * Default strategy: FIFO (oldest invoice first).
 * Partial payments update outstanding_amount on the ledger entry.
 * Overpayments trigger a credit note via the existing invoice handler.
 * Idempotent: deduplicated by payment_id.
 */
export const ArPaymentApplyCommandSchema = z.object({
	property_id: z.string().uuid(),
	ar_account_id: z.string().uuid(),
	payment_id: z.string().uuid(),
	payment_reference: z.string().max(150).optional(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).default("USD"),
	application_date: z.coerce.date().optional(),
	/**
	 * Manual allocation: [{city_ledger_id, amount}, ...].
	 * If omitted, FIFO allocation is applied automatically.
	 */
	invoice_allocations: z
		.array(
			z.object({
				city_ledger_id: z.string().uuid(),
				amount: z.coerce.number().positive(),
			}),
		)
		.optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArPaymentApplyCommand = z.infer<typeof ArPaymentApplyCommandSchema>;

/**
 * Reverse a misapplied cash application. Re-opens the city ledger entries.
 */
export const ArPaymentUnapplyCommandSchema = z.object({
	property_id: z.string().uuid(),
	cash_application_id: z.string().uuid(),
	reason: z.string().max(1000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArPaymentUnapplyCommand = z.infer<
	typeof ArPaymentUnapplyCommandSchema
>;

// ─── Disputes ────────────────────────────────────────────────────────────────

/**
 * Raise a dispute on a city ledger entry.
 *
 * Sets city_ledger status to DISPUTED and excludes the entry from dunning.
 * Both operations are atomic (same transaction).
 */
export const ArDisputeRaiseCommandSchema = z.object({
	property_id: z.string().uuid(),
	city_ledger_id: z.string().uuid(),
	reason: z.string().min(10).max(2000),
	disputed_amount: z.coerce.number().positive().optional(),
	raised_by: z.string().uuid().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArDisputeRaiseCommand = z.infer<typeof ArDisputeRaiseCommandSchema>;

/**
 * Resolve a dispute — partial or full.
 *
 * If partial, creates an adjusted invoice for the remainder.
 * Sets dispute status to RESOLVED and reopens city ledger for collection.
 */
export const ArDisputeResolveCommandSchema = z.object({
	property_id: z.string().uuid(),
	dispute_id: z.string().uuid(),
	/** Amount acknowledged as valid. If < full disputed_amount, creates adjusted invoice. */
	resolved_amount: z.coerce.number().nonnegative(),
	resolution_notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArDisputeResolveCommand = z.infer<
	typeof ArDisputeResolveCommandSchema
>;

/**
 * Escalate a dispute to legal/collections.
 * Sets AR account status to COLLECTIONS.
 */
export const ArDisputeEscalateCommandSchema = z.object({
	property_id: z.string().uuid(),
	dispute_id: z.string().uuid(),
	escalation_notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ArDisputeEscalateCommand = z.infer<
	typeof ArDisputeEscalateCommandSchema
>;
