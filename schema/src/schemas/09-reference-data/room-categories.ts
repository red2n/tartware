/**
 * DEV DOC
 * Module: schemas/09-reference-data/room-categories.ts
 * Description: RoomCategories Schema - Dynamic room category lookup table
 * Table: room_categories
 * Category: 09-reference-data
 * Primary exports: RoomCategoriesSchema, CreateRoomCategoriesSchema, UpdateRoomCategoriesSchema
 * @table room_categories
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * RoomCategories Schema
 * Configurable room categories replacing hardcoded ENUM.
 * Allows tenant-specific categorization with rate multipliers
 * and capacity defaults.
 *
 * @table room_categories
 * @category 09-reference-data
 * @synchronized 2026-02-05
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Dynamic field validation - actual values enforced by database CHECK constraints.
 * Do NOT hardcode enum values here; they are configurable in the lookup table.
 */
const tierCode = z.string().min(1).max(20);

/**
 * Complete RoomCategories schema
 */
export const RoomCategoriesSchema = z.object({
	// Primary Key
	category_id: uuid,

	// Multi-tenancy (NULL tenant_id = system default)
	tenant_id: uuid.optional().nullable(),
	property_id: uuid.optional().nullable(),

	// Category Identification
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
	description: z.string().optional().nullable(),

	// Classification (values enforced by DB CHECK constraints)
	tier: tierCode.default("STANDARD"),
	star_rating: z.number().min(1).max(5).optional().nullable(),

	// Pricing
	rate_multiplier: z.number().min(0).default(1.0),
	min_rate: money.optional().nullable(),
	max_rate: money.optional().nullable(),
	default_rate: money.optional().nullable(),

	// Capacity Defaults
	default_occupancy: z.number().int().min(1).default(2),
	max_occupancy: z.number().int().min(1).default(4),
	default_adults: z.number().int().min(1).default(2),
	max_adults: z.number().int().min(1).default(4),
	max_children: z.number().int().min(0).default(2),

	// Physical Attributes
	typical_size_sqft: z.number().int().optional().nullable(),
	typical_size_sqm: z.number().int().optional().nullable(),
	has_view: z.boolean().default(false),
	has_balcony: z.boolean().default(false),
	floor_preference: z.string().max(20).optional().nullable(),

	// Amenity Level
	amenity_level: z.string().max(20).default("STANDARD"),
	included_amenities: z.array(z.string()).optional().nullable(),
	upgrade_path: z.array(z.string()).optional().nullable(),

	// Mapping to Legacy Enum
	legacy_enum_value: z.string().max(50).optional().nullable(),

	// Display & UI
	display_order: z.number().int().default(0),
	color_code: z.string().max(7).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),
	image_url: z.string().max(255).optional().nullable(),

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

export type RoomCategories = z.infer<typeof RoomCategoriesSchema>;

/**
 * Schema for creating a new room category
 */
export const CreateRoomCategoriesSchema = RoomCategoriesSchema.omit({
	category_id: true,
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

export type CreateRoomCategories = z.infer<typeof CreateRoomCategoriesSchema>;

/**
 * Schema for updating a room category
 */
export const UpdateRoomCategoriesSchema = RoomCategoriesSchema.partial().omit({
	category_id: true,
	created_at: true,
	created_by: true,
	is_system: true,
});

export type UpdateRoomCategories = z.infer<typeof UpdateRoomCategoriesSchema>;
