/**
 * DEV DOC
 * Module: api/billing-rows.ts
 * Purpose: Raw PostgreSQL row shapes for billing-service / finance-admin-service query results.
 *          These types represent the shape returned by `pg` before API-level mapping.
 * Ownership: Schema package
 */

// =====================================================
// BILLING AUDIT EVENT INPUT
// =====================================================

/**
 * Input shape for writing a billing audit event via audit-logger.ts.
 *
 * Severity values map to the audit_logs.severity CHECK constraint (INFO | WARNING | CRITICAL | SECURITY).
 * Category values map to audit_logs.action_category (FINANCIAL | SECURITY | DATA_ACCESS | CONFIGURATION).
 *
 * Design note: kept as a `type` (not Zod) — this is a service-layer input contract,
 * not a DB row shape that needs runtime validation. All callers are internal TypeScript code.
 */
export type BillingAuditEventInput = {
	tenantId: string;
	propertyId?: string | null;
	/** Resolved actor UUID (use resolveActorId output). */
	userId: string;
	/** Short action key, e.g. "PAYMENT_CAPTURE". Prefixed with "BILLING." for event_type column. */
	action: string;
	/** Table/resource affected, e.g. "payment", "charge_posting", "invoice". */
	entityType: string;
	/** UUID of the affected row. */
	entityId?: string | null;
	/** Defaults to FINANCIAL. */
	category?: "FINANCIAL" | "SECURITY" | "DATA_ACCESS" | "CONFIGURATION";
	/** Defaults to INFO. */
	severity?: "INFO" | "WARNING" | "CRITICAL" | "SECURITY";
	/** Snapshot of record state before the change. Exclude card numbers and PAN. */
	oldValues?: Record<string, unknown>;
	/** Snapshot of record state after the change. Exclude card numbers and PAN. */
	newValues?: Record<string, unknown>;
	/** true for any operation touching payment amounts or instrument data (PCI-DSS Req 10). */
	isPciRelevant?: boolean;
	/** true for operations touching personal data: name, email, address (GDPR Art. 30). */
	isGdprRelevant?: boolean;
	/** Human-readable description for audit reviewers. */
	description?: string;
	metadata?: Record<string, unknown>;
};

// =====================================================
// BILLING PAYMENT ROW
// =====================================================

/** Raw row shape from billing payments query with joined reservation/guest data. */
export type BillingPaymentRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	reservation_id: string | null;
	confirmation_number: string | null;
	guest_id: string | null;
	reservation_guest_name: string | null;
	reservation_guest_email: string | null;
	guest_first_name: string | null;
	guest_last_name: string | null;
	payment_reference: string;
	external_transaction_id: string | null;
	transaction_type: string | null;
	payment_method: string | null;
	amount: number | string | null;
	currency: string | null;
	status: string | null;
	gateway_name: string | null;
	gateway_reference: string | null;
	processed_at: string | Date | null;
	created_at: string | Date;
	updated_at: string | Date | null;
	version: bigint | null;
};

// =====================================================
// FOLIO ROW
// =====================================================

/** Raw row shape from folios list query with joined property data. */
export type FolioRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	folio_number: string;
	folio_type: string;
	folio_status: string;
	reservation_id: string | null;
	confirmation_number: string | null;
	guest_id: string | null;
	guest_name: string | null;
	company_name: string | null;
	balance: number | string;
	total_charges: number | string;
	total_payments: number | string;
	total_credits: number | string;
	currency: string | null;
	opened_at: string | Date;
	closed_at: string | Date | null;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// CHARGE POSTING ROW
// =====================================================

/** Raw row shape from charge postings list query. */
export type ChargePostingRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	folio_id: string;
	folio_number: string | null;
	reservation_id: string | null;
	guest_id: string | null;
	guest_name: string | null;
	posting_date: string | Date;
	business_date: string | Date;
	transaction_type: string;
	posting_type: string;
	charge_code: string;
	charge_description: string;
	charge_category: string | null;
	quantity: number | string;
	unit_price: number | string;
	subtotal: number | string;
	tax_amount: number | string | null;
	service_charge: number | string | null;
	discount_amount: number | string | null;
	total_amount: number | string;
	currency: string | null;
	payment_method: string | null;
	source_system: string | null;
	outlet: string | null;
	is_voided: boolean;
	voided_at: string | Date | null;
	void_reason: string | null;
	created_at: string | Date;
	version: bigint | null;
};

// =====================================================
// LEDGER ENTRY ROW
// =====================================================

/** Raw row shape from the ledger entries list query. */
export type LedgerEntryRow = {
	gl_entry_id: string;
	gl_batch_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	batch_number: string | null;
	batch_date: string | Date | null;
	accounting_period: string | null;
	batch_status: string | null;
	folio_id: string | null;
	folio_number: string | null;
	reservation_id: string | null;
	confirmation_number: string | null;
	department_code: string | null;
	posting_date: string | Date;
	gl_account_code: string;
	cost_center: string | null;
	usali_category: string | null;
	description: string | null;
	debit_amount: number | string | null;
	credit_amount: number | string | null;
	currency: string | null;
	source_table: string | null;
	source_id: string | null;
	reference_number: string | null;
	status: string;
	posted_at: string | Date | null;
	created_at: string | Date;
};

/** Raw row shape from ledger-post charge source query with charge-code and folio joins. */
export type ChargeLedgerSourceRow = {
	posting_id: string;
	property_id: string;
	folio_id: string;
	reservation_id: string | null;
	posting_date: string | Date;
	department_code: string | null;
	charge_code: string;
	charge_description: string;
	charge_category: string | null;
	posting_type: string;
	subtotal: string | null;
	tax_amount: string | null;
	service_charge: string | null;
	discount_amount: string | null;
	total_amount: string;
	currency_code: string | null;
	gl_account: string | null;
	revenue_group: string | null;
	confirmation_number: string | null;
	folio_number: string | null;
};

/** Raw row shape from ledger-post payment source query with reservation/folio joins. */
export type PaymentLedgerSourceRow = {
	id: string;
	property_id: string;
	reservation_id: string | null;
	folio_id: string | null;
	payment_date: string | Date;
	payment_reference: string;
	transaction_type: string;
	payment_method: string | null;
	amount: string;
	currency: string | null;
	confirmation_number: string | null;
	folio_number: string | null;
};

// =====================================================
// PAYMENT COMMAND ROW
// =====================================================

/** Raw row shape from payments table for command processing. */
export type PaymentRow = {
	id: string;
	amount: number;
	refund_amount: number | null;
	payment_method: string;
	currency: string | null;
	payment_reference: string;
};

// =====================================================
// TAX CONFIGURATION ROW
// =====================================================

/** Raw row shape from tax_configurations table query. */
export type TaxConfigurationRow = {
	tax_config_id: string;
	tenant_id: string;
	property_id: string | null;
	property_name: string | null;
	tax_code: string;
	tax_name: string;
	tax_description: string | null;
	tax_type: string;
	tax_category: string | null;
	country_code: string;
	state_province: string | null;
	city: string | null;
	jurisdiction_name: string | null;
	jurisdiction_level: string | null;
	tax_authority_name: string | null;
	tax_registration_number: string | null;
	tax_rate: number | string;
	is_percentage: boolean;
	fixed_amount: number | string | null;
	effective_from: string | Date;
	effective_to: string | Date | null;
	is_active: boolean;
	calculation_method: string | null;
	calculation_base: string | null;
	is_compound_tax: boolean;
	rounding_method: string | null;
	rounding_precision: number;
	applies_to: string[];
	rate_type: string | null;
	display_on_invoice: boolean;
	display_separately: boolean;
	display_name: string | null;
	display_order: number | null;
	allows_exemptions: boolean;
	exemption_types: string[];
	tax_gl_account: string | null;
	remittance_frequency: string | null;
	times_applied: number;
	total_tax_collected: number | string;
	last_applied_at: string | Date | null;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// WEBHOOK EVENT ROW
// =====================================================

/** Raw row from payment_gateway_webhooks for idempotency checks and status updates. */
export type WebhookEventRow = {
	webhook_id: string;
	tenant_id: string;
	property_id: string | null;
	gateway_provider: string;
	/** Unique event ID sent by the gateway (e.g. evt_xxx from Stripe). Dedup key. */
	gateway_event_id: string;
	/** Normalized event type, e.g. payment.captured, refund.completed, dispute.created. */
	event_type: string;
	/** PENDING | PROCESSED | FAILED | SKIPPED */
	status: string;
	raw_payload: Record<string, unknown> | null;
	processing_error: string | null;
	received_at: string | Date;
	processed_at: string | Date | null;
	created_at: string | Date;
	updated_at: string | Date;
};

/** Minimal gateway config row needed for HMAC verification. */
export type WebhookGatewayConfigRow = {
	config_id: string;
	gateway_provider: string;
	/** Vault reference for the webhook signing secret — in dev treated as the raw secret. */
	webhook_secret_ref: string | null;
};

// =====================================================
// FISCAL PERIOD ROW
// =====================================================

/** Raw row shape from fiscal periods list query. */
export type FiscalPeriodRow = {
	fiscal_period_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	fiscal_year: number;
	fiscal_year_start: string | Date;
	fiscal_year_end: string | Date;
	period_number: number;
	period_name: string;
	period_start: string | Date;
	period_end: string | Date;
	period_status: string;
	is_reconciled: boolean | null;
	closed_at: string | Date | null;
	soft_closed_at: string | Date | null;
	locked_at: string | Date | null;
	total_revenue: number | string | null;
	total_expenses: number | string | null;
	net_income: number | string | null;
	notes: string | null;
};
