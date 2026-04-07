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
import {
	SettingsControlTypeEnum,
	SettingsDataTypeEnum,
	SettingsScopeEnum,
	SettingsSensitivityEnum,
} from "../shared/enums.js";

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
 * Create package request body schema.
 */
export const CreatePackageBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	package_name: z.string().min(1).max(200),
	package_code: z
		.string()
		.min(2)
		.max(50)
		.regex(/^[A-Za-z0-9_-]+$/),
	package_type: z.string().min(1),
	short_description: z.string().max(500).optional(),
	valid_from: z
		.string()
		.refine((v) => !Number.isNaN(Date.parse(v)), "Valid ISO date required"),
	valid_to: z
		.string()
		.refine((v) => !Number.isNaN(Date.parse(v)), "Valid ISO date required"),
	min_nights: z.number().int().min(1).default(1),
	max_nights: z.number().int().min(1).optional(),
	min_guests: z.number().int().min(1).default(1),
	max_guests: z.number().int().min(1).optional(),
	pricing_model: z.string().min(1).default("per_night"),
	base_price: z.number().min(0),
	includes_breakfast: z.boolean().default(false),
	includes_lunch: z.boolean().default(false),
	includes_dinner: z.boolean().default(false),
	includes_parking: z.boolean().default(false),
	includes_wifi: z.boolean().default(false),
	includes_airport_transfer: z.boolean().default(false),
	refundable: z.boolean().default(true),
	free_cancellation_days: z.number().int().min(0).optional(),
	total_inventory: z.number().int().min(0).optional(),
});

export type CreatePackageBody = z.infer<typeof CreatePackageBodySchema>;

/**
 * Create package response schema.
 */
export const CreatePackageResponseSchema = z.object({
	package_id: uuid,
	message: z.string(),
});

export type CreatePackageResponse = z.infer<typeof CreatePackageResponseSchema>;

/**
 * Create package component response schema.
 */
export const CreatePackageComponentResponseSchema = z.object({
	component_id: uuid,
	message: z.string(),
});

export type CreatePackageComponentResponse = z.infer<
	typeof CreatePackageComponentResponseSchema
>;

/**
 * Update package request body schema.
 * All fields optional — only provided fields are updated.
 */
export const UpdatePackageBodySchema = z.object({
	tenant_id: uuid,
	is_active: z.boolean().optional(),
	includes_breakfast: z.boolean().optional(),
	includes_lunch: z.boolean().optional(),
	includes_dinner: z.boolean().optional(),
	includes_parking: z.boolean().optional(),
	includes_wifi: z.boolean().optional(),
	includes_airport_transfer: z.boolean().optional(),
});

export type UpdatePackageBody = z.infer<typeof UpdatePackageBodySchema>;

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

/**
 * Schema for creating a new package component via API.
 */
export const CreatePackageComponentBodySchema = z.object({
	tenant_id: uuid,
	component_type: z.enum([
		"service",
		"amenity",
		"meal",
		"activity",
		"transportation",
		"upgrade",
		"credit",
		"voucher",
		"other",
	]),
	component_name: z.string().min(1).max(255),
	component_description: z.string().max(1000).optional(),
	quantity: z.number().int().min(1).default(1),
	pricing_type: z.enum([
		"per_night",
		"per_stay",
		"per_person",
		"per_person_per_night",
		"once",
		"daily",
		"included",
	]),
	unit_price: z.number().min(0).default(0),
	is_included: z.boolean().default(true),
	is_optional: z.boolean().default(false),
	is_mandatory: z.boolean().default(true),
	delivery_timing: z
		.enum([
			"on_arrival",
			"on_departure",
			"daily",
			"specific_date",
			"on_request",
			"anytime",
		])
		.optional(),
	delivery_location: z.string().max(255).optional(),
	display_order: z.number().int().min(0).default(0),
});

export type CreatePackageComponentBody = z.infer<
	typeof CreatePackageComponentBodySchema
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

// =====================================================
// SERVICE-LAYER INPUT TYPES (settings-service internal)
// =====================================================

/** Filters for querying settings values in the repository. */
export type SettingsValueFilters = {
	tenantId: string;
	scopeLevel?: string;
	settingId?: string;
	propertyId?: string;
	unitId?: string;
	userId?: string;
	activeOnly?: boolean;
};

/** Service-layer input for creating a settings value record. */
export type CreateSettingsValueInput = {
	tenantId: string;
	settingId: string;
	scopeLevel: string;
	value: unknown;
	propertyId?: string | null;
	unitId?: string | null;
	userId?: string | null;
	status?: string | null;
	notes?: string | null;
	effectiveFrom?: Date | string | null;
	effectiveTo?: Date | string | null;
	context?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	createdBy?: string | null;
};

/** Service-layer input for updating a settings value record. */
export type UpdateSettingsValueInput = {
	valueId: string;
	tenantId: string;
	value?: unknown;
	status?: string | null;
	notes?: string | null;
	effectiveFrom?: Date | string | null;
	effectiveTo?: Date | string | null;
	lockedUntil?: Date | string | null;
	context?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	updatedBy?: string | null;
};

/** Filters for querying settings catalog entities. */
export type SettingsCatalogFilters = {
	tenantId?: string;
	activeOnly: boolean;
	categoryId?: string;
	sectionId?: string;
	settingId?: string;
	search?: string;
};

/** Service-layer input for creating a package record. */
export type CreatePackageInput = {
	tenantId: string;
	propertyId?: string;
	packageName: string;
	packageCode: string;
	packageType: string;
	shortDescription?: string;
	validFrom: string;
	validTo: string;
	minNights: number;
	maxNights?: number;
	minGuests: number;
	maxGuests?: number;
	pricingModel: string;
	basePrice: number;
	includesBreakfast: boolean;
	includesLunch: boolean;
	includesDinner: boolean;
	includesParking: boolean;
	includesWifi: boolean;
	includesAirportTransfer: boolean;
	refundable: boolean;
	freeCancellationDays?: number;
	totalInventory?: number;
	createdBy?: string;
};

/** Service-layer input for updating a package record. */
export type UpdatePackageInput = {
	packageId: string;
	tenantId: string;
	isActive?: boolean;
	includesBreakfast?: boolean;
	includesLunch?: boolean;
	includesDinner?: boolean;
	includesParking?: boolean;
	includesWifi?: boolean;
	includesAirportTransfer?: boolean;
	updatedBy?: string;
};

/** Service-layer input for creating a package component record. */
export type CreatePackageComponentInput = {
	packageId: string;
	componentType: string;
	componentName: string;
	componentDescription?: string;
	quantity: number;
	pricingType: string;
	unitPrice: number;
	isIncluded: boolean;
	isOptional: boolean;
	isMandatory: boolean;
	deliveryTiming?: string;
	deliveryLocation?: string;
	displayOrder: number;
	createdBy?: string;
};

/** Seed data shape for a single settings definition in catalog data files. */
export type RawDefinition = {
	code: string;
	name: string;
	description: string;
	controlType: keyof typeof SettingsControlTypeEnum.enum;
	dataType: keyof typeof SettingsDataTypeEnum.enum;
	defaultScope: keyof typeof SettingsScopeEnum.enum;
	allowedScopes: Array<keyof typeof SettingsScopeEnum.enum>;
	overrideScopes?: Array<keyof typeof SettingsScopeEnum.enum>;
	defaultValue?: unknown;
	valueConstraints?: Record<string, unknown>;
	formSchema?: Record<string, unknown>;
	tags?: string[];
	moduleDependencies?: string[];
	referenceDocs?: string[];
	sensitivity?: keyof typeof SettingsSensitivityEnum.enum;
	options?: Array<{
		value: string;
		label: string;
		description?: string;
		icon?: string;
		color?: string;
		isDefault?: boolean;
	}>;
};

/** Seed data shape for a settings section containing definitions. */
export type RawSection = {
	code: string;
	name: string;
	description: string;
	icon?: string;
	tags?: string[];
	definitions: RawDefinition[];
};

/** Seed data shape for a top-level settings category. */
export type RawCategory = {
	code: string;
	name: string;
	description: string;
	icon: string;
	color?: string;
	tags?: string[];
	sections: RawSection[];
};

// =====================================================
// REPOSITORY INPUT TYPES — packages
// =====================================================

/** DB row shape returned by the packages list/detail SQL queries. */
export type PackageRow = {
	package_id: string;
	tenant_id: string;
	property_id: string | null;
	property_name: string | null;
	package_name: string;
	package_code: string;
	package_type: string;
	short_description: string | null;
	valid_from: string | Date;
	valid_to: string | Date;
	is_currently_valid: boolean;
	min_nights: number;
	max_nights: number | null;
	min_guests: number;
	max_guests: number | null;
	pricing_model: string;
	base_price: number | string;
	discount_percentage: number | string | null;
	includes_breakfast: boolean;
	includes_lunch: boolean;
	includes_dinner: boolean;
	includes_parking: boolean;
	includes_wifi: boolean;
	includes_airport_transfer: boolean;
	refundable: boolean;
	free_cancellation_days: number | null;
	available_inventory: number | null;
	total_inventory: number | null;
	sold_count: number;
	is_active: boolean;
	is_published: boolean;
	is_featured: boolean;
	total_bookings: number;
	total_revenue: number | string | null;
	average_rating: number | string | null;
	badge_text: string | null;
	image_urls: string[] | null;
	created_at: string | Date;
	updated_at: string | Date | null;
};

/** DB row shape returned by the package_components SQL query. */
export type PackageComponentRow = {
	component_id: string;
	package_id: string;
	component_type: string;
	component_name: string;
	component_description: string | null;
	quantity: number;
	pricing_type: string;
	unit_price: number | string;
	is_included: boolean;
	is_optional: boolean;
	is_mandatory: boolean;
	delivery_timing: string | null;
	delivery_location: string | null;
	display_order: number;
	is_active: boolean;
};

/** Query input for listing packages. */
export type ListPackagesInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	packageType?: string;
	isActive?: boolean;
	isPublished?: boolean;
	isFeatured?: boolean;
	validOn?: string;
};

/** Query input for fetching a single package by ID. */
export type GetPackageInput = {
	packageId: string;
	tenantId: string;
};

/** Query input for fetching components of a package. */
export type GetPackageComponentsInput = {
	packageId: string;
};

// =====================================================
// REPOSITORY INPUT TYPES — settings values store
// =====================================================

/** Filter criteria for querying seed settings values. */
export type SeedValueFilters = {
	tenantId?: string;
	scopeLevel?: string;
	settingId?: string;
	propertyId?: string;
	unitId?: string;
	userId?: string;
	activeOnly?: boolean;
};

/** Input for creating a new seed settings value. */
export type CreateSeedValueInput = {
	tenantId: string;
	settingId: string;
	scopeLevel: string;
	value?: unknown;
	propertyId?: string | null;
	unitId?: string | null;
	userId?: string | null;
	status?: "ACTIVE" | "PENDING" | "EXPIRED" | null;
	notes?: string | null;
	effectiveFrom?: Date | string | null;
	effectiveTo?: Date | string | null;
	context?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	createdBy?: string | null;
};

/** Input for updating an existing seed settings value. */
export type UpdateSeedValueInput = {
	valueId: string;
	tenantId: string;
	value?: unknown;
	status?: "ACTIVE" | "PENDING" | "EXPIRED" | null;
	notes?: string | null;
	effectiveFrom?: Date | string | null;
	effectiveTo?: Date | string | null;
	lockedUntil?: Date | string | null;
	context?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	updatedBy?: string | null;
};

// =====================================================
// SERVICE-LAYER TYPES — settings command service
// =====================================================

/** DB scope fields used to identify a settings value row. */
export type SettingsValueScope = {
	setting_id: string;
	scope_level: string;
	property_id: string | null;
	unit_id: string | null;
	user_id: string | null;
};

/** DB row shape for a settings value including scope + id + status. */
export type SettingsValueRow = SettingsValueScope & {
	id: string;
	status: string;
};
