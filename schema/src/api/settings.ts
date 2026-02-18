/**
 * DEV DOC
 * Module: api/settings.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	SettingsCategoriesSchema,
	SettingsDefinitionsSchema,
	SettingsOptionsSchema,
	SettingsSectionsSchema,
	SettingsValueStatusEnum,
	SettingsValuesSchema,
} from "../schemas/08-settings/index.js";
import { uuid } from "../shared/base-schemas.js";
import { SettingsScopeEnum } from "../shared/enums.js";

export const SettingsCatalogResponseSchema = z.object({
	data: z.object({
		categories: z.array(SettingsCategoriesSchema),
		sections: z.array(SettingsSectionsSchema),
		definitions: z.array(SettingsDefinitionsSchema),
		options: z.array(SettingsOptionsSchema),
	}),
	meta: z.object({
		counts: z.object({
			categories: z.number().int().nonnegative(),
			sections: z.number().int().nonnegative(),
			definitions: z.number().int().nonnegative(),
			options: z.number().int().nonnegative(),
		}),
		lastUpdated: z.string().nullable(),
	}),
});
export type SettingsCatalogResponse = z.infer<
	typeof SettingsCatalogResponseSchema
>;

export const SettingsValuesResponseSchema = z.object({
	data: z.array(SettingsValuesSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
		sampleTenantId: z.string().nullable(),
	}),
});
export type SettingsValuesResponse = z.infer<
	typeof SettingsValuesResponseSchema
>;

// =====================================================
// PACKAGES
// =====================================================

/**
 * Package type enum matching database constraints.
 */
export const PackageTypeEnum = z.enum([
	"room_only",
	"bed_and_breakfast",
	"half_board",
	"full_board",
	"all_inclusive",
	"romance",
	"spa",
	"golf",
	"ski",
	"family",
	"business",
	"weekend_getaway",
	"extended_stay",
	"seasonal",
	"custom",
]);
export type PackageType = z.infer<typeof PackageTypeEnum>;

/**
 * Package pricing model enum matching database constraints.
 */
export const PackagePricingModelEnum = z.enum([
	"per_night",
	"per_stay",
	"per_person",
	"per_person_per_night",
	"flat_rate",
	"tiered",
]);
export type PackagePricingModel = z.infer<typeof PackagePricingModelEnum>;

/**
 * Package list item schema for API responses.
 */
export const PackageListItemSchema = z.object({
	package_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	property_name: z.string().optional(),
	package_name: z.string(),
	package_code: z.string(),
	package_type: z.string(),
	package_type_display: z.string(),

	// Description
	short_description: z.string().nullable(),

	// Validity
	valid_from: z.string(),
	valid_to: z.string(),
	is_currently_valid: z.boolean(),

	// Booking requirements
	min_nights: z.number().int(),
	max_nights: z.number().int().nullable(),
	min_guests: z.number().int(),
	max_guests: z.number().int().nullable(),

	// Pricing
	pricing_model: z.string(),
	pricing_model_display: z.string(),
	base_price: z.number(),
	currency_code: z.string().default("USD"),
	discount_percentage: z.number().nullable(),

	// Inclusions
	includes_breakfast: z.boolean(),
	includes_lunch: z.boolean(),
	includes_dinner: z.boolean(),
	includes_parking: z.boolean(),
	includes_wifi: z.boolean(),
	includes_airport_transfer: z.boolean(),

	// Cancellation
	refundable: z.boolean(),
	free_cancellation_days: z.number().int().nullable(),

	// Availability
	available_inventory: z.number().int().nullable(),
	total_inventory: z.number().int().nullable(),
	sold_count: z.number().int(),

	// Status
	is_active: z.boolean(),
	is_published: z.boolean(),
	is_featured: z.boolean(),

	// Performance
	total_bookings: z.number().int(),
	total_revenue: z.number().nullable(),
	average_rating: z.number().nullable(),

	// Display
	badge_text: z.string().nullable(),
	image_urls: z.array(z.string()).nullable(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type PackageListItem = z.infer<typeof PackageListItemSchema>;

/**
 * Package list response schema.
 */
export const PackageListResponseSchema = z.object({
	data: z.array(PackageListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type PackageListResponse = z.infer<typeof PackageListResponseSchema>;

/**
 * Package component list item schema for API responses.
 */
export const PackageComponentListItemSchema = z.object({
	component_id: uuid,
	package_id: uuid,
	component_type: z.string(),
	component_type_display: z.string(),
	component_name: z.string(),
	component_description: z.string().nullable(),
	quantity: z.number().int(),
	pricing_type: z.string(),
	unit_price: z.number(),
	is_included: z.boolean(),
	is_optional: z.boolean(),
	is_mandatory: z.boolean(),
	delivery_timing: z.string().nullable(),
	delivery_location: z.string().nullable(),
	display_order: z.number().int(),
	is_active: z.boolean(),
});

export type PackageComponentListItem = z.infer<
	typeof PackageComponentListItemSchema
>;

// =====================================================
// CATALOG LIST SCHEMAS
// =====================================================

/** Category list response wrapper. */
export const SettingsCategoryListSchema = z.object({
	data: z.array(SettingsCategoriesSchema),
	meta: z.object({ count: z.number().int().nonnegative() }),
});
export type SettingsCategoryList = z.infer<typeof SettingsCategoryListSchema>;

/** Section list response wrapper. */
export const SettingsSectionListSchema = z.object({
	data: z.array(SettingsSectionsSchema),
	meta: z.object({ count: z.number().int().nonnegative() }),
});
export type SettingsSectionList = z.infer<typeof SettingsSectionListSchema>;

/** Definition list response wrapper. */
export const SettingsDefinitionListSchema = z.object({
	data: z.array(SettingsDefinitionsSchema),
	meta: z.object({ count: z.number().int().nonnegative() }),
});
export type SettingsDefinitionList = z.infer<
	typeof SettingsDefinitionListSchema
>;

/** Option list response wrapper. */
export const SettingsOptionListSchema = z.object({
	data: z.array(SettingsOptionsSchema),
	meta: z.object({ count: z.number().int().nonnegative() }),
});
export type SettingsOptionList = z.infer<typeof SettingsOptionListSchema>;

// =====================================================
// CATALOG QUERY SCHEMAS
// =====================================================

/** Base active-only filter used by all catalog queries. */
export const ActiveOnlyQuerySchema = z.object({
	active_only: z.coerce.boolean().default(true),
});
export type ActiveOnlyQuery = z.infer<typeof ActiveOnlyQuerySchema>;

/** Sections query with optional category filter. */
export const SectionsQuerySchema = ActiveOnlyQuerySchema.extend({
	category_id: z.string().uuid().optional(),
	category_code: z.string().min(2).max(64).optional(),
});
export type SectionsQuery = z.infer<typeof SectionsQuerySchema>;

/** Definitions query with optional category/section/search filters. */
export const DefinitionsQuerySchema = ActiveOnlyQuerySchema.extend({
	category_id: z.string().uuid().optional(),
	section_id: z.string().uuid().optional(),
	category_code: z.string().min(2).max(64).optional(),
	section_code: z.string().min(2).max(64).optional(),
	search: z.string().min(2).max(120).optional(),
});
export type DefinitionsQuery = z.infer<typeof DefinitionsQuerySchema>;

/** Options query with optional setting filter. */
export const OptionsQuerySchema = ActiveOnlyQuerySchema.extend({
	setting_id: z.string().uuid().optional(),
	setting_code: z.string().min(2).max(160).optional(),
});
export type OptionsQuery = z.infer<typeof OptionsQuerySchema>;

/** Values query with scope and entity filters. */
export const ValuesQuerySchema = ActiveOnlyQuerySchema.extend({
	scope_level: SettingsScopeEnum.optional(),
	setting_id: z.string().uuid().optional(),
	property_id: z.string().uuid().optional(),
	unit_id: z.string().uuid().optional(),
	user_id: z.string().uuid().optional(),
});
export type ValuesQuery = z.infer<typeof ValuesQuerySchema>;

// =====================================================
// VALUE MUTATION SCHEMAS
// =====================================================

/** Body schema for creating a settings value. */
export const CreateValueSchema = z.object({
	setting_id: z.string().uuid(),
	scope_level: SettingsScopeEnum,
	value: z.unknown().optional(),
	property_id: z.string().uuid().optional(),
	unit_id: z.string().uuid().optional(),
	user_id: z.string().uuid().optional(),
	status: SettingsValueStatusEnum.optional(),
	notes: z.string().max(1024).optional(),
	effective_from: z.string().datetime().optional(),
	effective_to: z.string().datetime().optional(),
	context: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
});
export type CreateValue = z.infer<typeof CreateValueSchema>;

/** Body schema for updating a settings value. */
export const UpdateValueSchema = CreateValueSchema.partial().extend({
	locked_until: z.string().datetime().optional(),
});
export type UpdateValue = z.infer<typeof UpdateValueSchema>;
