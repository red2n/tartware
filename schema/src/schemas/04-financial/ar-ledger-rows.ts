/**
 * DEV DOC
 * Module: schemas/04-financial/ar-ledger-rows.ts
 * Purpose: The row shapes of the accounts-receivable ledger, declared once.
 * Ownership: Schema package (single source of truth)
 *
 * These nine tables were the largest entry in `check:schema-first`'s
 * `KNOWN_UNTYPED` list — the debt that check exists to pay down, and the corner
 * of the product that moves money. Every one of them was read through an inline
 * `query<{ … }>` generic, with each caller re-deriving the columns it happened
 * to select. Seven files described `ar_city_ledger` seven different ways.
 *
 * **Why row types rather than zod objects.** These are not API boundaries. They
 * are what `pg` hands back, and the honest description of that is a type, not a
 * validator: nothing here is parsed, so a `z.object` would either be dead
 * weight or a lie about where validation happens. `AccountsReceivableSchema`
 * next door is the zod one, and it describes a different table.
 *
 * **Driver types, not domain types.** `NUMERIC` arrives as a **string** — node-pg
 * does not coerce it, because a 19,4 column does not fit a float without
 * lying — and `DATE`/`TIMESTAMPTZ` arrive as `Date` unless a type parser says
 * otherwise. Money is therefore `string` throughout, and callers convert at the
 * point of use. Typing these as `number` is the specific mistake that makes a
 * balance drift by a cent under load, which is why it is spelled out here.
 *
 * Callers that select a subset should say so with `Pick<>` rather than writing
 * a new shape: `Pick<ArCityLedgerRow, "entry_id" | "outstanding_balance">` is
 * checked against this file, and an inline object literal is not.
 */

// =====================================================
// STATUS VOCABULARIES
// =====================================================
//
// Each mirrors a CHECK constraint in scripts/tables/04-financial/. They are
// declared `as const` so the union and the runtime list stay one thing — a
// screen that renders a filter needs the values, and a handler comparing
// against a literal needs the type.

/** `ar_accounts.account_status` — 82_ar_accounts.sql */
export const AR_ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED", "COLLECTIONS", "CLOSED"] as const;
export type ArAccountStatus = (typeof AR_ACCOUNT_STATUSES)[number];

/** `ar_accounts.payment_terms` — the contractual terms, not a dunning stage. */
export const AR_PAYMENT_TERMS = ["NET30", "NET45", "NET60", "DUE_ON_RECEIPT"] as const;
export type ArPaymentTerms = (typeof AR_PAYMENT_TERMS)[number];

/** `ar_city_ledger.entry_status` — 83_ar_city_ledger.sql */
export const AR_ENTRY_STATUSES = [
	"OPEN",
	"PARTIAL",
	"PAID",
	"WRITTEN_OFF",
	"DISPUTED",
	"CANCELLED",
] as const;
export type ArEntryStatus = (typeof AR_ENTRY_STATUSES)[number];

/**
 * `ar_city_ledger.aging_bucket`.
 *
 * Denormalised alongside `days_outstanding` so an aging report does not
 * recompute buckets across every open entry on every run.
 */
export const AR_AGING_BUCKETS = [
	"CURRENT",
	"1_30",
	"31_60",
	"61_90",
	"91_120",
	"OVER_120",
] as const;
export type ArAgingBucket = (typeof AR_AGING_BUCKETS)[number];

/** `ar_cash_applications.application_status` — an application is applied or undone. */
export const AR_APPLICATION_STATUSES = ["APPLIED", "REVERSED"] as const;
export type ArApplicationStatus = (typeof AR_APPLICATION_STATUSES)[number];

/** `ar_disputes.dispute_status` — 87_ar_disputes.sql */
export const AR_DISPUTE_STATUSES = [
	"OPEN",
	"UNDER_REVIEW",
	"RESOLVED",
	"ESCALATED",
	"CLOSED",
] as const;
export type ArDisputeStatus = (typeof AR_DISPUTE_STATUSES)[number];

/** `ar_disputes.dispute_reason` — why the debtor is contesting the entry. */
export const AR_DISPUTE_REASONS = [
	"AMOUNT_INCORRECT",
	"CHARGE_NOT_RECOGNISED",
	"DUPLICATE_CHARGE",
	"SERVICE_NOT_DELIVERED",
	"RATE_DISAGREEMENT",
	"OTHER",
] as const;
export type ArDisputeReason = (typeof AR_DISPUTE_REASONS)[number];

/** `ar_disputes.resolution_outcome` — null while the dispute is still open. */
export const AR_DISPUTE_OUTCOMES = ["UPHELD", "REJECTED", "PARTIAL", "WRITE_OFF"] as const;
export type ArDisputeOutcome = (typeof AR_DISPUTE_OUTCOMES)[number];

/** `ar_dunning_events.event_type` — a rung of the ladder, or a pause on it. */
export const AR_DUNNING_EVENT_TYPES = [
	"FIRST_REMINDER",
	"SECOND_WARNING",
	"COLLECTIONS_REFERRAL",
	"SUPPRESS",
	"RESUME",
] as const;
export type ArDunningEventType = (typeof AR_DUNNING_EVENT_TYPES)[number];

/** `folio_windows.billed_to_type` — 76_folio_windows.sql */
export const FOLIO_WINDOW_BILLED_TO_TYPES = [
	"GUEST",
	"CORPORATE",
	"TRAVEL_AGENT",
	"OTHER",
] as const;
export type FolioWindowBilledToType = (typeof FOLIO_WINDOW_BILLED_TO_TYPES)[number];

// =====================================================
// ROW SHAPES
// =====================================================

/**
 * `ar_accounts` — the company a balance is owed by.
 *
 * `available_credit` is a **generated** column (`credit_limit -
 * outstanding_balance`, STORED). It can be selected and must never be written:
 * an INSERT or UPDATE naming it fails with 428C9. That is the reason it is
 * marked readonly here rather than left to a comment nobody reads at 2am.
 */
export type ArAccountRow = {
	ar_account_id: string;
	tenant_id: string;
	property_id: string;
	account_number: string;
	company_id: string | null;
	company_name: string;
	contact_name: string | null;
	contact_email: string | null;
	billing_address: string | null;
	credit_limit: string;
	payment_terms: ArPaymentTerms;
	currency: string;
	outstanding_balance: string;
	readonly available_credit: string;
	account_status: ArAccountStatus;
	suspended_at: Date | null;
	suspended_reason: string | null;
	dunning_level: number;
	dunning_suppressed_until: Date | null;
	notes: string | null;
	created_at: Date;
	updated_at: Date;
	created_by: string | null;
	updated_by: string | null;
	is_deleted: boolean;
};

/**
 * `ar_city_ledger` — one transferred balance, from the folio it left to the
 * day it is settled or written off.
 *
 * `folio_id` is nullable, and the partial unique index
 * `ar_city_ledger_folio_account_ux` is predicated on
 * `folio_id IS NOT NULL AND entry_status NOT IN (…)`. Any `ON CONFLICT` here
 * has to repeat **both** halves of that predicate: omitting the null test
 * matched no index and raised 42P10 on every transfer for as long as the
 * command existed.
 */
export type ArCityLedgerRow = {
	entry_id: string;
	tenant_id: string;
	property_id: string;
	ar_account_id: string;
	folio_id: string | null;
	reservation_id: string | null;
	invoice_id: string | null;
	entry_number: string;
	transfer_date: Date;
	due_date: Date;
	original_amount: string;
	outstanding_balance: string;
	currency: string;
	entry_status: ArEntryStatus;
	days_outstanding: number;
	aging_bucket: ArAgingBucket;
	written_off_at: Date | null;
	written_off_by: string | null;
	write_off_reason: string | null;
	dispute_id: string | null;
	notes: string | null;
	created_at: Date;
	updated_at: Date;
	created_by: string | null;
	updated_by: string | null;
};

/**
 * `ar_aging_snapshots` — what the ledger looked like on one date.
 *
 * Written by the aging run and never updated: a snapshot that changes after
 * the fact cannot answer "what did we report last month", which is the only
 * question it exists for. Hence no `updated_at` / `updated_by`.
 */
export type ArAgingSnapshotRow = {
	snapshot_id: string;
	tenant_id: string;
	property_id: string;
	ar_account_id: string;
	snapshot_date: Date;
	current_amount: string;
	bucket_1_30: string;
	bucket_31_60: string;
	bucket_61_90: string;
	bucket_91_120: string;
	bucket_over_120: string;
	total_outstanding: string;
	currency: string;
	created_at: Date;
	created_by: string | null;
};

/**
 * `ar_dunning_events` — a rung of the collections ladder, or a pause on it.
 *
 * `entry_ids` is a `UUID[]`, which node-pg returns as a real array of strings
 * rather than the brace-literal Postgres prints. Append-only, like the
 * snapshots.
 */
export type ArDunningEventRow = {
	dunning_event_id: string;
	tenant_id: string;
	property_id: string;
	ar_account_id: string;
	event_type: ArDunningEventType;
	entry_ids: string[] | null;
	amount_overdue: string | null;
	currency: string;
	suppressed_until: Date | null;
	suppress_reason: string | null;
	communication_sent: boolean;
	communication_ref: string | null;
	notes: string | null;
	created_at: Date;
	created_by: string | null;
};

/**
 * `ar_cash_applications` — a payment applied against one ledger entry.
 *
 * Reversal is a status change plus a stamp, not a delete: the row is the
 * evidence that the money was once applied, and a receivable that can be
 * un-applied silently is one nobody can reconcile.
 */
export type ArCashApplicationRow = {
	application_id: string;
	tenant_id: string;
	property_id: string;
	ar_account_id: string;
	entry_id: string;
	payment_id: string | null;
	payment_reference: string | null;
	payment_date: Date;
	applied_amount: string;
	currency: string;
	application_status: ArApplicationStatus;
	reversed_at: Date | null;
	reversed_by: string | null;
	reversal_reason: string | null;
	notes: string | null;
	created_at: Date;
	updated_at: Date;
	created_by: string | null;
	updated_by: string | null;
};

/**
 * `ar_disputes` — a contested entry, and how it ended.
 *
 * `resolution_outcome` is null until `dispute_status` reaches RESOLVED; the two
 * are separate columns because a dispute can close without an outcome (the
 * debtor withdraws it) and the report has to tell those apart.
 */
export type ArDisputeRow = {
	dispute_id: string;
	tenant_id: string;
	property_id: string;
	ar_account_id: string;
	entry_id: string;
	dispute_reason: ArDisputeReason;
	dispute_amount: string;
	currency: string;
	dispute_notes: string | null;
	dispute_status: ArDisputeStatus;
	resolved_at: Date | null;
	resolved_by: string | null;
	resolution_outcome: ArDisputeOutcome | null;
	resolution_notes: string | null;
	escalated_at: Date | null;
	escalated_by: string | null;
	escalation_notes: string | null;
	created_at: Date;
	updated_at: Date;
	created_by: string | null;
	updated_by: string | null;
};

/**
 * `folio_windows` — a date range on a folio billed to one payer.
 *
 * The three money columns are maintained by the routing rules that post into
 * the window, so they are a running total rather than a derivation: reading
 * `window_balance` is not the same as summing the postings, and the two can
 * disagree if a posting bypasses the routing layer.
 */
export type FolioWindowRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	reservation_id: string;
	folio_id: string;
	window_start: Date;
	window_end: Date;
	billed_to: string;
	billed_to_type: FolioWindowBilledToType;
	window_charges: string | null;
	window_payments: string | null;
	window_balance: string | null;
	notes: string | null;
	metadata: Record<string, unknown> | null;
	created_at: Date | null;
	updated_at: Date | null;
	created_by: string | null;
	updated_by: string | null;
};

/**
 * `invoice_sequences` — the per-property, per-year invoice counter.
 *
 * No surrogate key: the primary key is
 * `(tenant_id, property_id, document_type, fiscal_year)`, and `last_number` is
 * bumped under a row lock. A gap in an invoice sequence is a question from an
 * auditor, so this is one of the few counters that must not be advanced
 * optimistically.
 */
export type InvoiceSequenceRow = {
	tenant_id: string;
	property_id: string;
	document_type: string;
	fiscal_year: number;
	last_number: number;
	updated_at: Date;
};

/**
 * `payment_gateway_webhooks` — the provider's callback, exactly as it arrived.
 *
 * `raw_payload` is stored before anything is believed about it: a webhook is
 * an untrusted message from outside, and the row is what lets a disputed
 * capture be re-read months later. `(gateway_provider, gateway_event_id)` is
 * unique, which is what makes redelivery idempotent.
 */
export type PaymentGatewayWebhookRow = {
	webhook_id: string;
	tenant_id: string;
	property_id: string | null;
	gateway_provider: string;
	gateway_event_id: string;
	event_type: string;
	status: string;
	raw_payload: Record<string, unknown>;
	processing_error: string | null;
	received_at: Date;
	processed_at: Date | null;
	created_at: Date;
	updated_at: Date;
};
