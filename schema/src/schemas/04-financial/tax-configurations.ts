/**
 * DEV DOC
 * Module: schemas/04-financial/tax-configurations.ts
 * Description: TaxConfigurations Schema
 * Table: tax_configurations
 * Category: 04-financial
 * Primary exports: TaxConfigurationsSchema, CreateTaxConfigurationsSchema, UpdateTaxConfigurationsSchema
 * @table tax_configurations
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * TaxConfigurations Schema
 * @table tax_configurations
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete TaxConfigurations schema
 */
export const TaxConfigurationsSchema = z.object({
	tax_config_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	tax_code: z.string(),
	tax_name: z.string(),
	tax_description: z.string().optional(),
	tax_type: z.string(),
	tax_category: z.string().optional(),
	country_code: z.string(),
	state_province: z.string().optional(),
	city: z.string().optional(),
	jurisdiction_name: z.string().optional(),
	jurisdiction_level: z.string().optional(),
	tax_authority_name: z.string().optional(),
	tax_authority_id: z.string().optional(),
	tax_registration_number: z.string().optional(),
	tax_account_number: z.string().optional(),
	tax_rate: money,
	is_percentage: z.boolean().optional(),
	fixed_amount: money.optional(),
	effective_from: z.coerce.date(),
	effective_to: z.coerce.date().optional(),
	is_active: z.boolean().optional(),
	calculation_method: z.string().optional(),
	calculation_base: z.string().optional(),
	is_compound_tax: z.boolean().optional(),
	compound_on_tax_codes: z.array(z.string()).optional(),
	compound_order: z.number().int().optional(),
	rounding_method: z.string().optional(),
	rounding_precision: z.number().int().optional(),
	applies_to: z.array(z.string()).optional(),
	excluded_items: z.array(z.string()).optional(),
	rate_type: z.string().optional(),
	is_tiered: z.boolean().optional(),
	tier_ranges: z.record(z.unknown()).optional(),
	per_person_rate: money.optional(),
	per_night_rate: money.optional(),
	max_nights: z.number().int().optional(),
	max_persons: z.number().int().optional(),
	minimum_taxable_amount: money.optional(),
	maximum_taxable_amount: money.optional(),
	minimum_tax_amount: money.optional(),
	maximum_tax_amount: money.optional(),
	allows_exemptions: z.boolean().optional(),
	exemption_types: z.array(z.string()).optional(),
	exemption_certificate_required: z.boolean().optional(),
	applies_to_guest_types: z.array(z.string()).optional(),
	excluded_guest_types: z.array(z.string()).optional(),
	applies_to_rate_codes: z.array(z.string()).optional(),
	excluded_rate_codes: z.array(z.string()).optional(),
	applies_to_room_types: z.array(uuid).optional(),
	excluded_room_types: z.array(uuid).optional(),
	has_seasonal_rates: z.boolean().optional(),
	seasonal_rates: z.record(z.unknown()).optional(),
	tax_report_category: z.string().optional(),
	tax_gl_account: z.string().optional(),
	revenue_account: z.string().optional(),
	liability_account: z.string().optional(),
	remittance_frequency: z.string().optional(),
	remittance_due_day: z.number().int().optional(),
	last_remittance_date: z.coerce.date().optional(),
	next_remittance_date: z.coerce.date().optional(),
	filing_required: z.boolean().optional(),
	filing_frequency: z.string().optional(),
	filing_due_day: z.number().int().optional(),
	last_filing_date: z.coerce.date().optional(),
	next_filing_date: z.coerce.date().optional(),
	requires_registration: z.boolean().optional(),
	registration_date: z.coerce.date().optional(),
	registration_expiry: z.coerce.date().optional(),
	certificate_required: z.boolean().optional(),
	certificate_number: z.string().optional(),
	certificate_expiry: z.coerce.date().optional(),
	display_on_invoice: z.boolean().optional(),
	display_on_folio: z.boolean().optional(),
	display_separately: z.boolean().optional(),
	display_name: z.string().optional(),
	display_order: z.number().int().optional(),
	show_in_online_booking: z.boolean().optional(),
	include_in_total_price: z.boolean().optional(),
	is_part_of_composite: z.boolean().optional(),
	composite_tax_id: uuid.optional(),
	replaced_by_config_id: uuid.optional(),
	replaces_config_id: uuid.optional(),
	version: z.number().int().optional(),
	alert_before_expiry_days: z.number().int().optional(),
	expiry_alert_sent: z.boolean().optional(),
	validation_rules: z.record(z.unknown()).optional(),
	requires_approval: z.boolean().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	times_applied: z.number().int().optional(),
	total_tax_collected: money.optional(),
	last_applied_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string()).optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	regulation_reference: z.string().optional(),
	regulation_url: z.string().optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type TaxConfigurations = z.infer<typeof TaxConfigurationsSchema>;

/**
 * Schema for creating a new tax configurations
 */
export const CreateTaxConfigurationsSchema = TaxConfigurationsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateTaxConfigurations = z.infer<
	typeof CreateTaxConfigurationsSchema
>;

/**
 * Schema for updating a tax configurations
 */
export const UpdateTaxConfigurationsSchema = TaxConfigurationsSchema.partial();

export type UpdateTaxConfigurations = z.infer<
	typeof UpdateTaxConfigurationsSchema
>;
