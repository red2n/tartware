/**
 * DEV DOC
 * Module: api/billing.ts
 * Purpose: Billing API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { BillingPricingBulkRecommendCommandSchema } from "../events/commands/billing.js";
import { uuid } from "../shared/base-schemas.js";
import {
	PaymentMethodEnum,
	PaymentStatusEnum,
	TransactionTypeEnum,
} from "../shared/enums.js";

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
	invoice_number: z.string().nullable(),
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

/**
 * Ledger entry list item schema for API responses.
 */
export const LedgerEntryListItemSchema = z.object({
	gl_entry_id: uuid,
	gl_batch_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	batch_number: z.string().optional(),
	batch_date: z.string().optional(),
	accounting_period: z.string().optional(),
	batch_status: z.string().optional(),
	batch_status_display: z.string().optional(),
	folio_id: uuid.optional(),
	folio_number: z.string().optional(),
	reservation_id: uuid.optional(),
	confirmation_number: z.string().optional(),
	department_code: z.string().optional(),
	posting_date: z.string(),
	gl_account_code: z.string(),
	cost_center: z.string().optional(),
	usali_category: z.string().optional(),
	description: z.string().optional(),
	debit_amount: z.number(),
	credit_amount: z.number(),
	currency: z.string().optional(),
	source_table: z.string().optional(),
	source_id: uuid.optional(),
	reference_number: z.string().optional(),
	status: z.string(),
	status_display: z.string(),
	posted_at: z.string().optional(),
	created_at: z.string(),
});

export type LedgerEntryListItem = z.infer<typeof LedgerEntryListItemSchema>;

/**
 * Ledger entry list response schema.
 */
export const LedgerEntryListResponseSchema = z.object({
	data: z.array(LedgerEntryListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type LedgerEntryListResponse = z.infer<
	typeof LedgerEntryListResponseSchema
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

export const FiscalPeriodListResponseSchema = z.object({
	data: z.array(FiscalPeriodListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type FiscalPeriodListResponse = z.infer<typeof FiscalPeriodListResponseSchema>;

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

// =====================================================
// DEPARTMENTAL REVENUE REPORT
// =====================================================

/** Single department line item in a departmental revenue report. */
export const DepartmentalRevenueItemSchema = z.object({
	department: z.string(),
	charge_count: z.number().int(),
	gross_revenue: z.number(),
	adjustments: z.number(),
	net_revenue: z.number(),
});

export type DepartmentalRevenueItem = z.infer<
	typeof DepartmentalRevenueItemSchema
>;

/** Departmental revenue report response. */
export const DepartmentalRevenueResponseSchema = z.object({
	items: z.array(DepartmentalRevenueItemSchema),
	total_gross: z.number(),
	total_net: z.number(),
});

export type DepartmentalRevenueResponse = z.infer<
	typeof DepartmentalRevenueResponseSchema
>;

// =====================================================
// TAX SUMMARY REPORT
// =====================================================

/** Single tax line item in a tax summary report. */
export const TaxSummaryItemSchema = z.object({
	tax_name: z.string(),
	tax_type: z.string(),
	jurisdiction: z.string(),
	taxable_amount: z.number(),
	tax_collected: z.number(),
	transaction_count: z.number().int(),
});

export type TaxSummaryItem = z.infer<typeof TaxSummaryItemSchema>;

/** Tax summary report response. */
export const TaxSummaryResponseSchema = z.object({
	items: z.array(TaxSummaryItemSchema),
	total_tax_collected: z.number(),
});

export type TaxSummaryResponse = z.infer<typeof TaxSummaryResponseSchema>;

// =====================================================
// COMMISSION REPORT
// =====================================================

/** Single source line item in a commission report. */
export const CommissionReportItemSchema = z.object({
	source: z.string(),
	reservation_count: z.number().int(),
	room_revenue: z.number(),
	commission_amount: z.number(),
	commission_rate_avg: z.number(),
});

export type CommissionReportItem = z.infer<typeof CommissionReportItemSchema>;

/** Commission report response. */
export const CommissionReportResponseSchema = z.object({
	items: z.array(CommissionReportItemSchema),
	total_commission: z.number(),
});

export type CommissionReportResponse = z.infer<
	typeof CommissionReportResponseSchema
>;

// -----------------------------------------------------------------------------
// Pricing Rule Evaluation Utilities (shared by billing-service and finance-admin-service)
// -----------------------------------------------------------------------------

/**
 * Pricing rule condition. Mirrors the JSONB `conditions` column
 * on the pricing_rules table.
 */
export interface PricingCondition {
	field: string;
	operator: string;
	value: unknown;
}

/**
 * Row shape returned by pricing_rules SELECT queries used by the pricing engine.
 * Distinct from the wider PricingRuleRow in revenue-rows which includes display fields.
 */
export interface PricingEngineRuleRow {
	rule_id: string;
	rule_name: string;
	rule_type: string;
	priority: number;
	conditions: PricingCondition[] | null;
	adjustment_type: string;
	adjustment_value: number;
	adjustment_cap_min: number | null;
	adjustment_cap_max: number | null;
	can_combine_with_other_rules: boolean;
	conflict_resolution: string;
}

/**
 * Evaluate a single pricing condition against the runtime evaluation context.
 * Returns true when the condition is satisfied (or cannot be determined).
 */
export const evalPricingCondition = (
	cond: PricingCondition,
	ctx: Record<string, unknown>,
): boolean => {
	const actual = ctx[cond.field];
	if (actual === undefined || actual === null) return false;
	const numActual = Number(actual);
	const numValue = Number(cond.value);
	switch (cond.operator) {
		case ">=":
			return numActual >= numValue;
		case "<=":
			return numActual <= numValue;
		case ">":
			return numActual > numValue;
		case "<":
			return numActual < numValue;
		case "=":
		case "==":
			return String(actual) === String(cond.value);
		case "!=":
			return String(actual) !== String(cond.value);
		case "in":
			return (
				Array.isArray(cond.value) &&
				(cond.value as unknown[]).map(String).includes(String(actual))
			);
		default:
			return false;
	}
};

/**
 * Apply a pricing adjustment to a base rate, clamping to optional min/max
 * caps and rounding to two decimal places. Returns 0 if the result is negative.
 */
export const applyPricingAdjustment = (
	baseRate: number,
	adjustmentType: string,
	adjustmentValue: number,
	capMin: number | null,
	capMax: number | null,
): number => {
	let adjusted: number;
	switch (adjustmentType) {
		case "percentage_increase":
			adjusted = baseRate * (1 + adjustmentValue / 100);
			break;
		case "percentage_decrease":
			adjusted = baseRate * (1 - adjustmentValue / 100);
			break;
		case "fixed_amount_increase":
			adjusted = baseRate + adjustmentValue;
			break;
		case "fixed_amount_decrease":
			adjusted = baseRate - adjustmentValue;
			break;
		case "set_to_amount":
			adjusted = adjustmentValue;
			break;
		default:
			adjusted = baseRate;
	}
	if (capMin != null) adjusted = Math.max(adjusted, capMin);
	if (capMax != null) adjusted = Math.min(adjusted, capMax);
	return Math.max(0, Math.round(adjusted * 100) / 100);
};

/**
 * Extended rule row used in bulk pricing queries that include per-row date
 * range strings and room-type ID for pre-fetched filtering.
 */
export type BulkPricingRuleRow = PricingEngineRuleRow & {
	room_type_id: string | null;
	effective_from_str: string | null;
	effective_to_str: string | null;
};

/** Input for computing a single room-type × date pricing cell. */
export interface BulkPricingCellInput {
	allRules: BulkPricingRuleRow[];
	roomTypeId: string;
	basePrice: number;
	date: Date;
	demand?: Record<string, unknown>;
}

/** Result of computing a single room-type × date pricing cell. */
export interface BulkPricingCellResult {
	adjustedRate: number;
	matched: PricingEngineRuleRow[];
	dateStr: string;
}

/**
 * Compute the adjusted rate for one room-type × date combination from a
 * pre-fetched set of pricing rules. Pure function — no side effects.
 *
 * Covers: rule scoping, condition evaluation, adjustment application with
 * combinability logic.
 */
export const computeBulkPricingCell = (
	input: BulkPricingCellInput,
): BulkPricingCellResult => {
	const { allRules, roomTypeId, basePrice, date, demand } = input;
	const dateStr = date.toISOString().slice(0, 10);

	const evalCtx: Record<string, unknown> = {
		occupancy_percent: demand
			? Number(demand.occupancy_percent ?? 0)
			: undefined,
		demand_level: demand?.demand_level
			? String(demand.demand_level)
			: undefined,
		days_until_arrival: Math.max(
			0,
			Math.floor((date.getTime() - Date.now()) / 86400000),
		),
		day_of_week: date.getDay(),
	};

	const scopedRules = allRules.filter(
		(r) =>
			(r.room_type_id === null || r.room_type_id === roomTypeId) &&
			(r.effective_from_str === null || r.effective_from_str <= dateStr) &&
			(r.effective_to_str === null || r.effective_to_str >= dateStr),
	);

	const matched = scopedRules.filter((r) => {
		if (
			!r.conditions ||
			!Array.isArray(r.conditions) ||
			r.conditions.length === 0
		)
			return true;
		return (r.conditions).every((c) =>
			evalPricingCondition(c, evalCtx),
		);
	});

	let adjustedRate = basePrice;
	for (const rule of matched) {
		if (!rule.can_combine_with_other_rules) {
			adjustedRate = applyPricingAdjustment(
				basePrice,
				rule.adjustment_type,
				rule.adjustment_value,
				rule.adjustment_cap_min,
				rule.adjustment_cap_max,
			);
			break;
		}
		adjustedRate = applyPricingAdjustment(
			adjustedRate,
			rule.adjustment_type,
			rule.adjustment_value,
			rule.adjustment_cap_min,
			rule.adjustment_cap_max,
		);
	}

	return { adjustedRate, matched, dateStr };
};

// -----------------------------------------------------------------------------
// Shared bulk pricing recommendations implementation (dependency-injected DB)
// -----------------------------------------------------------------------------

/**
 * Generic query function type compatible with both billing-service and
 * finance-admin-service pg query wrappers.
 * Uses `any[]` for `rows` to avoid friction with pg's `QueryResultRow` constraint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PricingQueryFn = (
	sql: string,
	params?: unknown[],
) => Promise<{ rows: any[] }>;

/**
 * Shared implementation for the `billing.pricing.bulk_recommend` command.
 * Accepts an injected `queryFn` so both billing-service and finance-admin-service
 * can share this logic without cross-service imports.
 *
 * @returns JSON string with `{ generated, room_types, dates }`.
 */
export const bulkGeneratePricingRecommendationsImpl = async (
	payload: unknown,
	tenantId: string,
	actorId: string,
	queryFn: PricingQueryFn,
): Promise<string> => {
	const command = BillingPricingBulkRecommendCommandSchema.parse(payload);

	const roomTypeFilter = command.room_type_ids?.length
		? `AND id = ANY($2::uuid[])`
		: `AND ($2::uuid[] IS NULL OR TRUE)`;
	const { rows: roomTypesRaw } = await queryFn(
		`SELECT id, name, COALESCE(base_price, 0) AS base_price FROM room_types
     WHERE tenant_id = $1 AND property_id = $3 AND is_deleted = false
     ${roomTypeFilter}
     ORDER BY name`,
		[tenantId, command.room_type_ids ?? null, command.property_id],
	);
	const roomTypes = roomTypesRaw as Array<{
		id: string;
		name: string;
		base_price: number;
	}>;

	const startDate = new Date(command.start_date);
	const endDate = new Date(command.end_date);
	const dates: Date[] = [];
	for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
		dates.push(new Date(d));
	}

	const { rows: demandRowsRaw } = await queryFn(
		`SELECT calendar_date::text, occupancy_percent, demand_level
     FROM demand_calendar
     WHERE tenant_id = $1 AND property_id = $2
       AND calendar_date >= $3::date AND calendar_date <= $4::date`,
		[
			tenantId,
			command.property_id,
			startDate.toISOString().slice(0, 10),
			endDate.toISOString().slice(0, 10),
		],
	);
	const demandRows = demandRowsRaw as Record<string, unknown>[];
	const demandMap = new Map(
		demandRows.map((r) => [String(r.calendar_date), r]),
	);

	const roomTypeIds = roomTypes.map((rt) => rt.id);
	const { rows: allRulesRaw } = await queryFn(
		`SELECT rule_id, rule_name, rule_type, priority,
            room_type_id, effective_from::text AS effective_from_str, effective_to::text AS effective_to_str,
            conditions, adjustment_type,
            COALESCE(adjustment_value, 0) AS adjustment_value,
            adjustment_cap_min, adjustment_cap_max,
            COALESCE(can_combine_with_other_rules, true) AS can_combine_with_other_rules,
            COALESCE(conflict_resolution, 'highest_priority') AS conflict_resolution
     FROM pricing_rules
     WHERE tenant_id = $1 AND property_id = $2
       AND is_active = true AND is_deleted = false
       AND (room_type_id IS NULL OR room_type_id = ANY($3::uuid[]))
       AND (effective_from IS NULL OR effective_from <= $5::date)
       AND (effective_to IS NULL OR effective_to >= $4::date)
     ORDER BY priority ASC`,
		[
			tenantId,
			command.property_id,
			roomTypeIds,
			startDate.toISOString().slice(0, 10),
			endDate.toISOString().slice(0, 10),
		],
	);
	const allRules = allRulesRaw as BulkPricingRuleRow[];

	let generated = 0;

	for (const roomType of roomTypes) {
		for (const date of dates) {
			const demand = demandMap.get(date.toISOString().slice(0, 10));
			const { adjustedRate, matched, dateStr } = computeBulkPricingCell({
				allRules,
				roomTypeId: roomType.id,
				basePrice: roomType.base_price,
				date,
				demand,
			});

			if (!command.dry_run) {
				const recommendationId = crypto.randomUUID();
				await queryFn(
					`INSERT INTO rate_recommendations (
             recommendation_id, tenant_id, property_id, room_type_id,
             recommendation_date, current_rate, recommended_rate,
             adjustment_amount, adjustment_percent,
             recommendation_reason, recommendation_source,
             confidence_score, review_status,
             created_at, created_by
           ) VALUES (
             $1, $2, $3, $4,
             $5::date, $6, $7,
             $8, $9,
             $10, 'pricing_engine',
             $11, 'pending',
             NOW(), $12
           )
           ON CONFLICT (property_id, room_type_id, recommendation_date)
             WHERE review_status = 'pending'
           DO UPDATE SET
             recommended_rate = EXCLUDED.recommended_rate,
             adjustment_amount = EXCLUDED.adjustment_amount,
             adjustment_percent = EXCLUDED.adjustment_percent,
             recommendation_reason = EXCLUDED.recommendation_reason,
             confidence_score = EXCLUDED.confidence_score,
             updated_at = NOW()`,
					[
						recommendationId,
						tenantId,
						command.property_id,
						roomType.id,
						dateStr,
						roomType.base_price,
						adjustedRate,
						adjustedRate - roomType.base_price,
						roomType.base_price > 0
							? Math.round(
									((adjustedRate - roomType.base_price) / roomType.base_price) *
										10000,
								) / 100
							: 0,
						`${matched.length} pricing rules applied (${matched.map((r) => r.rule_type).join(", ")})`,
						matched.length > 0 ? 80 : 50,
						actorId,
					],
				);
				generated++;
			}
		}
	}

	return JSON.stringify({
		generated,
		room_types: roomTypes.length,
		dates: dates.length,
	});
};

// =====================================================
// SERVICE-LAYER RESULT TYPES
// =====================================================

/**
 * Result of cancellation fee calculation.
 * Returned by `calculateCancellationFee()` in cancellation-fee-service.
 */
export type CancellationFeeResult = {
	/** Calculated cancellation fee (0 if within free-cancel window or no policy). */
	fee: number;
	/** Whether the cancellation is within the penalty window. */
	withinPenaltyWindow: boolean;
	/** Policy type applied. */
	policyType: string;
	/** Hours remaining until check-in at time of calculation. */
	hoursUntilCheckIn: number;
	/** Policy deadline hours. */
	policyDeadlineHours: number;
};

/* ── Folio Routing Evaluation ── */

/** Input to the routing rule evaluation engine. */
export type EvaluateRoutingInput = {
	tenantId: string;
	propertyId: string;
	folioId: string;
	chargeCode: string;
	transactionType?: string;
	chargeCategory?: string;
	amount: number;
};

/** A single routing decision produced by evaluateRoutingRules(). */
export type RoutingDecision = {
	/** Destination folio UUID where this portion of the charge should be posted. */
	destinationFolioId: string;
	/** Dollar amount routed to this destination. */
	routedAmount: number;
	/** The routing rule that matched. */
	ruleId: string;
};

/** Full result of the routing engine evaluation. */
export type RoutingEvaluationResult = {
	/** List of routing decisions (may be empty if no rules matched). */
	decisions: RoutingDecision[];
	/** Amount remaining on the source folio after routing. */
	remainderAmount: number;
};

// ============================================================================
// FOLIO ROUTING RULES — LIST / DETAIL SCHEMAS
// ============================================================================

/** Routing rule list item schema for API responses. */
export const RoutingRuleListItemSchema = z.object({
	rule_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	rule_name: z.string(),
	rule_code: z.string().nullable(),
	description: z.string().nullable(),
	is_template: z.boolean(),
	template_id: uuid.nullable(),
	source_folio_id: uuid.nullable(),
	source_reservation_id: uuid.nullable(),
	destination_folio_id: uuid.nullable(),
	destination_folio_type: z.string().nullable(),
	charge_code_pattern: z.string().nullable(),
	transaction_type: z.string().nullable(),
	charge_category: z.string().nullable(),
	min_amount: z.coerce.number().nullable(),
	max_amount: z.coerce.number().nullable(),
	routing_type: z.string(),
	routing_percentage: z.coerce.number().nullable(),
	routing_fixed_amount: z.coerce.number().nullable(),
	priority: z.number().int(),
	stop_on_match: z.boolean(),
	effective_from: z.string().nullable(),
	effective_until: z.string().nullable(),
	auto_apply_to_group: z.boolean(),
	auto_apply_to_company: z.boolean(),
	company_id: uuid.nullable(),
	group_booking_id: uuid.nullable(),
	is_active: z.boolean(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export type RoutingRuleListItem = z.infer<typeof RoutingRuleListItemSchema>;

/** Query parameters for listing routing rules. */
export const RoutingRuleListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	folio_id: uuid.optional(),
	is_template: z.coerce.boolean().optional(),
	is_active: z.coerce.boolean().optional(),
	charge_category: z.string().optional(),
	limit: z.coerce.number().int().positive().max(200).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type RoutingRuleListQuery = z.infer<typeof RoutingRuleListQuerySchema>;

// ============================================================================
// BILLING ROUTE QUERY SCHEMAS
// ============================================================================

/** Query parameters for listing general ledger entries. */
export const LedgerEntryListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	status: z.string().toLowerCase().optional(),
	batch_status: z.string().toLowerCase().optional(),
	gl_account_code: z.string().optional(),
	department_code: z.string().optional(),
	start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	limit: z.coerce.number().int().positive().max(500).default(200),
	offset: z.coerce.number().int().min(0).default(0),
});

export type LedgerEntryListQuery = z.infer<typeof LedgerEntryListQuerySchema>;

/** Query parameters for listing billing payments. */
export const BillingPaymentListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	reservation_id: uuid.optional(),
	status: z
		.string()
		.toLowerCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				PaymentStatusEnum.options
					.map((s) => s.toLowerCase())
					.includes(value),
			{ message: "Invalid payment status" },
		),
	transaction_type: z
		.string()
		.toLowerCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				TransactionTypeEnum.options
					.map((t) => t.toLowerCase())
					.includes(value),
			{ message: "Invalid transaction type" },
		),
	payment_method: z
		.string()
		.toLowerCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				PaymentMethodEnum.options
					.map((m) => m.toLowerCase())
					.includes(value),
			{ message: "Invalid payment method" },
		),
	limit: z.coerce.number().int().positive().max(200).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type BillingPaymentListQuery = z.infer<
	typeof BillingPaymentListQuerySchema
>;

/** Query parameters for listing folios. */
export const FolioListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	folio_status: z.string().optional(),
	folio_type: z.string().optional(),
	reservation_id: uuid.optional(),
	guest_id: uuid.optional(),
	limit: z.coerce.number().int().positive().max(200).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type FolioListQuery = z.infer<typeof FolioListQuerySchema>;

/** Query parameters for listing charge postings. */
export const ChargePostingListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	folio_id: uuid.optional(),
	reservation_id: uuid.optional(),
	transaction_type: z.string().optional(),
	charge_code: z.string().optional(),
	include_voided: z.coerce.boolean().optional(),
	limit: z.coerce.number().int().positive().max(200).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type ChargePostingListQuery = z.infer<
	typeof ChargePostingListQuerySchema
>;

/** Query parameters for listing cashier sessions. */
export const CashierSessionListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	session_status: z.string().optional(),
	user_id: uuid.optional(),
	shift_type: z.string().optional(),
	limit: z.coerce.number().int().positive().max(200).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

export type CashierSessionListQuery = z.infer<
	typeof CashierSessionListQuerySchema
>;

/** Query parameters for the pre-audit checklist. */
export const PreAuditQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
});

export type PreAuditQuery = z.infer<typeof PreAuditQuerySchema>;

/** Query parameters for the bucket check (occupancy verification). */
export const BucketCheckQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	business_date: z.string().optional(),
});

export type BucketCheckQuery = z.infer<typeof BucketCheckQuerySchema>;
