/**
 * DEV DOC
 * Module: api/billing.ts
 * Purpose: Billing API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

/**
 * Billing payment list item schema for API responses.
 * Includes display fields derived from enum values.
 */
export const BillingPaymentListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	reservation_id: uuid.optional(),
	confirmation_number: z.string().optional(),
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	payment_reference: z.string(),
	external_transaction_id: z.string().optional(),
	transaction_type: z.string(),
	transaction_type_display: z.string(),
	payment_method: z.string(),
	payment_method_display: z.string(),
	status: z.string(),
	status_display: z.string(),
	amount: z.number(),
	currency: z.string(),
	processed_at: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	version: z.string(),
	gateway_name: z.string().optional(),
	gateway_reference: z.string().optional(),
});

export type BillingPaymentListItem = z.infer<
	typeof BillingPaymentListItemSchema
>;

/**
 * Billing payment list response schema.
 */
export const BillingPaymentListResponseSchema = z.object({
	data: z.array(BillingPaymentListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type BillingPaymentListResponse = z.infer<
	typeof BillingPaymentListResponseSchema
>;

/**
 * Invoice list item schema for API responses.
 */
export const InvoiceListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	reservation_id: uuid,
	confirmation_number: z.string().optional(),
	guest_id: uuid,
	guest_name: z.string().optional(),
	invoice_number: z.string(),
	invoice_type: z.string(),
	invoice_type_display: z.string(),
	invoice_date: z.string(),
	due_date: z.string().optional(),
	subtotal: z.number(),
	tax_amount: z.number(),
	discount_amount: z.number(),
	total_amount: z.number(),
	paid_amount: z.number(),
	balance_due: z.number(),
	currency: z.string(),
	status: z.string(),
	status_display: z.string(),
	sent_at: z.string().optional(),
	pdf_url: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	version: z.string(),
});

export type InvoiceListItem = z.infer<typeof InvoiceListItemSchema>;

/**
 * Invoice list response schema.
 */
export const InvoiceListResponseSchema = z.object({
	data: z.array(InvoiceListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type InvoiceListResponse = z.infer<typeof InvoiceListResponseSchema>;

/**
 * Folio list item schema for API responses.
 */
export const FolioListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	folio_number: z.string(),
	folio_type: z.string(),
	folio_type_display: z.string(),
	folio_status: z.string(),
	folio_status_display: z.string(),
	reservation_id: uuid.optional(),
	confirmation_number: z.string().optional(),
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	company_name: z.string().optional(),
	balance: z.number(),
	total_charges: z.number(),
	total_payments: z.number(),
	total_credits: z.number(),
	currency: z.string(),
	opened_at: z.string(),
	closed_at: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type FolioListItem = z.infer<typeof FolioListItemSchema>;

/**
 * Folio list response schema.
 */
export const FolioListResponseSchema = z.object({
	data: z.array(FolioListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type FolioListResponse = z.infer<typeof FolioListResponseSchema>;

/**
 * Charge posting list item schema for API responses.
 */
export const ChargePostingListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	folio_id: uuid,
	folio_number: z.string().optional(),
	reservation_id: uuid.optional(),
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	posting_date: z.string(),
	business_date: z.string(),
	transaction_type: z.string(),
	transaction_type_display: z.string(),
	posting_type: z.string(),
	posting_type_display: z.string(),
	charge_code: z.string(),
	charge_description: z.string(),
	charge_category: z.string().optional(),
	quantity: z.number(),
	unit_price: z.number(),
	subtotal: z.number(),
	tax_amount: z.number(),
	service_charge: z.number(),
	discount_amount: z.number(),
	total_amount: z.number(),
	currency: z.string(),
	payment_method: z.string().optional(),
	source_system: z.string().optional(),
	outlet: z.string().optional(),
	is_voided: z.boolean(),
	voided_at: z.string().optional(),
	void_reason: z.string().optional(),
	created_at: z.string(),
	version: z.string(),
});

export type ChargePostingListItem = z.infer<typeof ChargePostingListItemSchema>;

/**
 * Charge posting list response schema.
 */
export const ChargePostingListResponseSchema = z.object({
	data: z.array(ChargePostingListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type ChargePostingListResponse = z.infer<
	typeof ChargePostingListResponseSchema
>;

// =====================================================
// TAX CONFIGURATIONS
// =====================================================

/**
 * Tax type enum matching database constraints.
 */
export const TaxTypeEnum = z.enum([
	"SALES_TAX",
	"VAT",
	"GST",
	"OCCUPANCY_TAX",
	"TOURISM_TAX",
	"CITY_TAX",
	"STATE_TAX",
	"FEDERAL_TAX",
	"RESORT_FEE",
	"SERVICE_CHARGE",
	"EXCISE_TAX",
	"CUSTOMS_DUTY",
	"OTHER",
]);
export type TaxType = z.infer<typeof TaxTypeEnum>;

/**
 * Tax calculation method enum.
 */
export const TaxCalculationMethodEnum = z.enum([
	"INCLUSIVE",
	"EXCLUSIVE",
	"COMPOUND",
	"CASCADING",
	"ADDITIVE",
	"TIERED",
	"PROGRESSIVE",
	"FLAT",
	"CUSTOM",
]);
export type TaxCalculationMethod = z.infer<typeof TaxCalculationMethodEnum>;

/**
 * Tax configuration list item schema for API responses.
 */
export const TaxConfigurationListItemSchema = z.object({
	tax_config_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	property_name: z.string().optional(),

	// Tax Identification
	tax_code: z.string(),
	tax_name: z.string(),
	tax_description: z.string().nullable(),
	tax_type: z.string(),
	tax_type_display: z.string(),
	tax_category: z.string().nullable(),

	// Jurisdiction
	country_code: z.string(),
	state_province: z.string().nullable(),
	city: z.string().nullable(),
	jurisdiction_name: z.string().nullable(),
	jurisdiction_level: z.string().nullable(),

	// Tax Authority
	tax_authority_name: z.string().nullable(),
	tax_registration_number: z.string().nullable(),

	// Tax Rate
	tax_rate: z.number(),
	is_percentage: z.boolean(),
	fixed_amount: z.number().nullable(),

	// Effective Dates
	effective_from: z.string(),
	effective_to: z.string().nullable(),
	is_active: z.boolean(),

	// Calculation
	calculation_method: z.string().nullable(),
	calculation_base: z.string().nullable(),
	is_compound_tax: z.boolean(),
	rounding_method: z.string().nullable(),
	rounding_precision: z.number().int(),

	// Applicability
	applies_to: z.array(z.string()),
	rate_type: z.string().nullable(),

	// Display
	display_on_invoice: z.boolean(),
	display_separately: z.boolean(),
	display_name: z.string().nullable(),
	display_order: z.number().int().nullable(),

	// Exemptions
	allows_exemptions: z.boolean(),
	exemption_types: z.array(z.string()),

	// Reporting
	tax_gl_account: z.string().nullable(),
	remittance_frequency: z.string().nullable(),

	// Usage
	times_applied: z.number().int(),
	total_tax_collected: z.number(),
	last_applied_at: z.string().optional(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type TaxConfigurationListItem = z.infer<
	typeof TaxConfigurationListItemSchema
>;

/**
 * Tax configuration list response schema.
 */
export const TaxConfigurationListResponseSchema = z.object({
	data: z.array(TaxConfigurationListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type TaxConfigurationListResponse = z.infer<
	typeof TaxConfigurationListResponseSchema
>;

// =====================================================
// TRIAL BALANCE REPORT
// =====================================================

/** Individual line item in a trial balance report. */
export const TrialBalanceLineItemSchema = z.object({
	category: z.string(),
	charge_code: z.string().nullable(),
	debit_total: z.number(),
	credit_total: z.number(),
	net: z.number(),
});

export type TrialBalanceLineItem = z.infer<typeof TrialBalanceLineItemSchema>;

/** Trial balance report — debits vs credits with department/charge-code breakdown. */
export const TrialBalanceResponseSchema = z.object({
	business_date: z.string(),
	property_id: z.string().nullable(),
	line_items: z.array(TrialBalanceLineItemSchema),
	total_debits: z.number(),
	total_credits: z.number(),
	total_payments: z.number(),
	variance: z.number(),
	is_balanced: z.boolean(),
});

export type TrialBalanceResponse = z.infer<typeof TrialBalanceResponseSchema>;

// =====================================================
// ACCOUNTS RECEIVABLE RESPONSE SCHEMAS
// =====================================================

/** AR list item — summary view for list endpoints. */
export const AccountsReceivableListItemSchema = z.object({
	ar_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	ar_number: z.string(),
	ar_reference: z.string().optional(),
	account_type: z.string(),
	account_type_display: z.string(),
	account_name: z.string(),
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	company_id: uuid.optional(),
	source_type: z.string().optional(),
	source_reference: z.string().optional(),
	reservation_id: uuid.optional(),
	invoice_id: uuid.optional(),
	folio_id: uuid.optional(),
	transaction_date: z.string(),
	due_date: z.string().optional(),
	original_amount: z.string(),
	outstanding_balance: z.string(),
	paid_amount: z.string(),
	currency: z.string(),
	ar_status: z.string(),
	ar_status_display: z.string(),
	aging_bucket: z.string().optional(),
	aging_bucket_display: z.string().optional(),
	aging_days: z.number().int().optional(),
	is_overdue: z.boolean(),
	payment_terms: z.string().optional(),
	payment_count: z.number().int().optional(),
	last_payment_date: z.string().optional(),
	priority: z.string().optional(),
	created_at: z.string(),
});

export type AccountsReceivableListItem = z.infer<
	typeof AccountsReceivableListItemSchema
>;

/** AR detail — full record with payment history and extended fields. */
export const AccountsReceivableDetailSchema =
	AccountsReceivableListItemSchema.extend({
		account_id: uuid.optional(),
		account_code: z.string().optional(),
		contact_name: z.string().optional(),
		contact_email: z.string().optional(),
		contact_phone: z.string().optional(),
		billing_address: z.unknown().optional(),
		days_overdue: z.number().int().optional(),
		payment_terms_days: z.number().int().optional(),
		early_payment_discount_percent: z.string().optional(),
		early_payment_discount_days: z.number().int().optional(),
		discount_deadline: z.string().optional(),
		late_fee_applicable: z.boolean().optional(),
		late_fees_charged: z.string().optional(),
		interest_applicable: z.boolean().optional(),
		interest_accrued: z.string().optional(),
		last_payment_amount: z.string().optional(),
		payments: z.unknown().optional(),
		in_collection: z.boolean().optional(),
		collection_notes: z.string().optional(),
		disputed: z.boolean().optional(),
		dispute_reason: z.string().optional(),
		dispute_amount: z.string().optional(),
		written_off: z.boolean().optional(),
		write_off_amount: z.string().optional(),
		write_off_reason: z.string().optional(),
		write_off_date: z.string().optional(),
		is_bad_debt: z.boolean().optional(),
		has_payment_plan: z.boolean().optional(),
		installment_count: z.number().int().optional(),
		next_installment_due_date: z.string().optional(),
		notes: z.string().optional(),
		internal_notes: z.string().optional(),
		tags: z.array(z.string()).optional(),
		updated_at: z.string().optional(),
	});

export type AccountsReceivableDetail = z.infer<
	typeof AccountsReceivableDetailSchema
>;

/** AR aging summary — bucket totals for a property. */
export const ArAgingSummarySchema = z.object({
	property_id: uuid,
	property_name: z.string().optional(),
	current: z.string(),
	days_1_30: z.string(),
	days_31_60: z.string(),
	days_61_90: z.string(),
	days_91_120: z.string(),
	over_120: z.string(),
	total_outstanding: z.string(),
	total_accounts: z.number().int(),
	currency: z.string(),
});

export type ArAgingSummary = z.infer<typeof ArAgingSummarySchema>;

// =====================================================
// FISCAL PERIODS
// =====================================================

export const FiscalPeriodStatusEnum = z.enum([
	"FUTURE",
	"OPEN",
	"SOFT_CLOSE",
	"CLOSED",
	"LOCKED",
]);
export type FiscalPeriodStatus = z.infer<typeof FiscalPeriodStatusEnum>;

export const FiscalPeriodListItemSchema = z.object({
	fiscal_period_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	fiscal_year: z.number().int(),
	fiscal_year_start: z.string(),
	fiscal_year_end: z.string(),
	period_number: z.number().int(),
	period_name: z.string(),
	period_start: z.string(),
	period_end: z.string(),
	period_status: FiscalPeriodStatusEnum,
	period_status_display: z.string(),
	is_reconciled: z.boolean(),
	closed_at: z.string().optional(),
	soft_closed_at: z.string().optional(),
	locked_at: z.string().optional(),
	total_revenue: z.string().optional(),
	total_expenses: z.string().optional(),
	net_income: z.string().optional(),
	notes: z.string().optional(),
});

export type FiscalPeriodListItem = z.infer<typeof FiscalPeriodListItemSchema>;

// =====================================================
// SHIFT SUMMARY (CASHIER HANDOVER)
// =====================================================

/** Shift handover summary for a cashier session. */
export const ShiftSummaryResponseSchema = z.object({
	session_id: z.string().uuid(),
	session_number: z.string(),
	cashier_name: z.string(),
	terminal_id: z.string().nullable(),
	shift_type: z.string(),
	session_status: z.string(),
	business_date: z.string(),
	opened_at: z.string(),
	closed_at: z.string().nullable(),
	opening_float: z.number(),
	closing_cash_counted: z.number().nullable(),
	cash_variance: z.number().nullable(),
	has_variance: z.boolean(),
	reconciled: z.boolean(),
	total_transactions: z.number(),
	total_revenue: z.number(),
	total_refunds: z.number(),
	net_revenue: z.number(),
	charge_count: z.number(),
	charge_total: z.number(),
	payment_count: z.number(),
	payment_total: z.number(),
	handover_notes: z.string().nullable(),
});

export type ShiftSummaryResponse = z.infer<typeof ShiftSummaryResponseSchema>;

// =====================================================
// PRE-AUDIT CHECKLIST
// =====================================================

/** Single check item in a pre-audit checklist. */
export const PreAuditCheckItemSchema = z.object({
	check: z.string(),
	passed: z.boolean(),
	detail: z.string(),
});

export type PreAuditCheckItem = z.infer<typeof PreAuditCheckItemSchema>;

/** Pre-audit checklist response — all checks for a property/business date. */
export const PreAuditResponseSchema = z.object({
	business_date: z.string(),
	checks: z.array(PreAuditCheckItemSchema),
});

export type PreAuditResponse = z.infer<typeof PreAuditResponseSchema>;

// =====================================================
// BUCKET CHECK (OCCUPANCY VERIFICATION)
// =====================================================

/** Single bucket check line item. */
export const BucketCheckItemSchema = z.object({
	category: z.string(),
	expected: z.number(),
	actual: z.number(),
	matched: z.boolean(),
	detail: z.string(),
});

export type BucketCheckItem = z.infer<typeof BucketCheckItemSchema>;

/** Bucket check (occupancy verification) response. */
export const BucketCheckResponseSchema = z.object({
	business_date: z.string(),
	items: z.array(BucketCheckItemSchema),
	is_balanced: z.boolean(),
});

export type BucketCheckResponse = z.infer<typeof BucketCheckResponseSchema>;
