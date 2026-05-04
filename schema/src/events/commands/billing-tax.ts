/**
 * Billing command schemas — Tax domain
 * Covers tax config create/update/delete and tax exemption application.
 * @category commands
 */

import { z } from "zod";

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

/**
 * Apply a tax exemption to a folio or reservation.
 * Sets tax_exempt = true and records the exemption certificate reference
 * for audit. Affects future charge postings — previously posted charges
 * are NOT automatically reversed (use billing.charge.void + repost if needed).
 */
export const BillingTaxExemptionApplyCommandSchema = z
	.object({
		property_id: z.string().uuid(),
		folio_id: z.string().uuid().optional(),
		reservation_id: z.string().uuid().optional(),
		exemption_type: z.enum(["DIPLOMATIC", "GOVERNMENT", "NON_PROFIT", "RESALE", "EDUCATIONAL", "OTHER"]),
		exemption_certificate: z.string().max(200),
		exemption_reason: z.string().max(500).optional(),
		/** ISO date when the certificate expires. */
		expiry_date: z.string().date().optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(v) => Boolean(v.folio_id || v.reservation_id),
		"folio_id or reservation_id is required",
	);

export type BillingTaxExemptionApplyCommand = z.infer<
	typeof BillingTaxExemptionApplyCommandSchema
>;
