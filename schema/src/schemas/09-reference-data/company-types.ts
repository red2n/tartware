/**
 * DEV DOC
 * Module: schemas/09-reference-data/company-types.ts
 * Description: CompanyTypes Schema - Dynamic company type lookup table
 * Table: company_types
 * Category: 09-reference-data
 * Primary exports: CompanyTypesSchema, CreateCompanyTypesSchema, UpdateCompanyTypesSchema
 * @table company_types
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * CompanyTypes Schema
 * Configurable company/account types (CORPORATE, OTA, TRAVEL_AGENCY, etc.)
 * replacing hardcoded ENUM. Includes billing terms, commission settings,
 * and distribution channel classification.
 *
 * @table company_types
 * @category 09-reference-data
 * @synchronized 2026-02-05
 */

import { z } from "zod";

import { uuid, money, percentage } from "../../shared/base-schemas.js";

/**
 * Company category enum
 */
export const CompanyCategoryEnum = z.enum([
	"CORPORATE",
	"INTERMEDIARY",
	"GOVERNMENT",
	"ASSOCIATION",
	"SUPPLIER",
	"PARTNER",
	"INTERNAL",
	"OTHER",
]);

export type CompanyCategory = z.infer<typeof CompanyCategoryEnum>;

/**
 * Relationship type enum
 */
export const RelationshipTypeEnum = z.enum([
	"B2B",
	"B2B2C",
	"B2G",
	"VENDOR",
	"AFFILIATE",
	"INTERNAL",
]);

export type RelationshipType = z.infer<typeof RelationshipTypeEnum>;

/**
 * Rate access type enum
 */
export const RateAccessTypeEnum = z.enum([
	"PUBLIC",
	"NEGOTIATED",
	"NET",
	"CONFIDENTIAL",
]);

export type RateAccessType = z.infer<typeof RateAccessTypeEnum>;

/**
 * Review frequency enum
 */
export const ReviewFrequencyEnum = z.enum([
	"MONTHLY",
	"QUARTERLY",
	"ANNUAL",
	"BIENNIAL",
	"NONE",
]);

export type ReviewFrequency = z.infer<typeof ReviewFrequencyEnum>;

/**
 * Complete CompanyTypes schema
 */
export const CompanyTypesSchema = z.object({
	// Primary Key
	type_id: uuid,

	// Multi-tenancy (NULL tenant_id = system default)
	tenant_id: uuid.optional().nullable(),
	property_id: uuid.optional().nullable(),

	// Company Type Identification
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
	description: z.string().optional().nullable(),

	// Classification
	category: CompanyCategoryEnum.default("CORPORATE"),
	relationship_type: RelationshipTypeEnum.default("B2B"),

	// Billing & AR Settings
	has_ar_account: z.boolean().default(true),
	requires_po: z.boolean().default(false),
	default_payment_terms: z.number().int().min(0).default(30),
	default_credit_limit: money.optional().nullable(),

	// Commission & Rates
	pays_commission: z.boolean().default(false),
	receives_commission: z.boolean().default(false),
	default_commission_pct: percentage.optional().nullable(),
	has_negotiated_rates: z.boolean().default(false),
	rate_access_type: RateAccessTypeEnum.default("PUBLIC"),

	// Distribution Flags
	is_direct_sell: z.boolean().default(false),
	is_reseller: z.boolean().default(false),
	is_contracted: z.boolean().default(false),
	is_preferred: z.boolean().default(false),

	// Tax & Compliance
	requires_w9: z.boolean().default(false),
	requires_tax_exempt: z.boolean().default(false),
	requires_insurance_cert: z.boolean().default(false),

	// Contact Requirements
	requires_travel_arranger: z.boolean().default(false),
	requires_booker_list: z.boolean().default(false),

	// Volume & Performance
	tracks_production: z.boolean().default(true),
	has_volume_commitment: z.boolean().default(false),
	review_frequency: ReviewFrequencyEnum.default("ANNUAL"),

	// Mapping to Legacy Enum
	legacy_enum_value: z.string().max(50).optional().nullable(),

	// GDS/Distribution Codes
	iata_agency_type: z.string().max(10).optional().nullable(),
	arc_type: z.string().max(10).optional().nullable(),
	clia_type: z.string().max(10).optional().nullable(),

	// Display & UI
	display_order: z.number().int().default(0),
	color_code: z.string().max(7).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),

	// System vs Custom
	is_system: z.boolean().default(false),
	is_active: z.boolean().default(true),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),
});

export type CompanyTypes = z.infer<typeof CompanyTypesSchema>;

/**
 * Schema for creating a new company type
 */
export const CreateCompanyTypesSchema = CompanyTypesSchema.omit({
	type_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
}).extend({
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
});

export type CreateCompanyTypes = z.infer<typeof CreateCompanyTypesSchema>;

/**
 * Schema for updating a company type
 */
export const UpdateCompanyTypesSchema = CompanyTypesSchema.partial().omit({
	type_id: true,
	created_at: true,
	created_by: true,
	is_system: true,
});

export type UpdateCompanyTypes = z.infer<typeof UpdateCompanyTypesSchema>;
