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
