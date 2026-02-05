/**
 * DEV DOC
 * Module: schemas/09-reference-data/rate-types.ts
 * Description: RateTypes Schema - Dynamic rate type lookup table
 * Table: rate_types
 * Category: 09-reference-data
 * Primary exports: RateTypesSchema, CreateRateTypesSchema, UpdateRateTypesSchema
 * @table rate_types
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * RateTypes Schema
 * Configurable rate type codes (RACK, BAR, CORPORATE, etc.)
 * replacing hardcoded ENUM. Allows tenant-specific rate types
 * with behavioral flags for revenue management and distribution.
 *
 * @table rate_types
 * @category 09-reference-data
 * @synchronized 2026-02-05
 */

import { z } from "zod";

import { uuid, percentage } from "../../shared/base-schemas.js";

/**
 * Rate type category enum
 */
export const RateTypeCategoryEnum = z.enum([
	"PUBLISHED",
	"TRANSIENT",
	"NEGOTIATED",
	"PROMOTIONAL",
	"PACKAGE",
	"WHOLESALE",
	"INTERNAL",
	"RESTRICTION",
	"OTHER",
]);

export type RateTypeCategory = z.infer<typeof RateTypeCategoryEnum>;

/**
 * Complete RateTypes schema
 */
export const RateTypesSchema = z.object({
	// Primary Key
	type_id: uuid,

	// Multi-tenancy (NULL tenant_id = system default)
	tenant_id: uuid.optional().nullable(),
	property_id: uuid.optional().nullable(),

	// Rate Type Identification
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
	category: RateTypeCategoryEnum.default("TRANSIENT"),

	// Rate Behavior
	is_public: z.boolean().default(true),
	is_refundable: z.boolean().default(true),
	is_commissionable: z.boolean().default(true),
	is_discounted: z.boolean().default(false),
	is_yielded: z.boolean().default(true),
	is_derived: z.boolean().default(false),

	// Restrictions
	requires_deposit: z.boolean().default(false),
	requires_prepayment: z.boolean().default(false),
	requires_guarantee: z.boolean().default(true),
	min_advance_days: z.number().int().min(0).default(0),
	max_advance_days: z.number().int().optional().nullable(),

	// Commission & Distribution
	default_commission_pct: percentage.optional().nullable(),
	ota_eligible: z.boolean().default(true),
	gds_eligible: z.boolean().default(true),

	// Priority (for rate selection)
	priority: z.number().int().default(100),
	rate_hierarchy_level: z.number().int().min(1).default(1),

	// Mapping to Legacy Enum
	legacy_enum_value: z.string().max(50).optional().nullable(),

	// Display & UI
	display_order: z.number().int().default(0),
	color_code: z.string().max(7).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),
	badge_text: z.string().max(20).optional().nullable(),

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

export type RateTypes = z.infer<typeof RateTypesSchema>;

/**
 * Schema for creating a new rate type
 */
export const CreateRateTypesSchema = RateTypesSchema.omit({
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

export type CreateRateTypes = z.infer<typeof CreateRateTypesSchema>;

/**
 * Schema for updating a rate type
 */
export const UpdateRateTypesSchema = RateTypesSchema.partial().omit({
	type_id: true,
	created_at: true,
	created_by: true,
	is_system: true,
});

export type UpdateRateTypes = z.infer<typeof UpdateRateTypesSchema>;
