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
	SettingsValuesSchema,
} from "../schemas/08-settings/index.js";
import { uuid } from "../shared/base-schemas.js";

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
export type SettingsCatalogResponse = z.infer<typeof SettingsCatalogResponseSchema>;

export const SettingsValuesResponseSchema = z.object({
	data: z.array(SettingsValuesSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
		sampleTenantId: z.string().nullable(),
	}),
});
export type SettingsValuesResponse = z.infer<typeof SettingsValuesResponseSchema>;

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

export type PackageComponentListItem = z.infer<typeof PackageComponentListItemSchema>;
