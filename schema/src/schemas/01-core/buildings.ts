/**
 * DEV DOC
 * Module: schemas/01-core/buildings.ts
 * Description: Buildings Schema - Physical buildings/wings within a property
 * Table: buildings
 * Category: 01-core
 * Primary exports: BuildingsSchema, CreateBuildingsSchema, UpdateBuildingsSchema
 * @table buildings
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Buildings Schema
 * Physical buildings, wings, or towers within a property.
 * Used for room assignment, housekeeping routing, and guest wayfinding.
 *
 * @table buildings
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const BuildingsSchema = z.object({
	// Primary Key
	building_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Building Identification
	building_code: z.string().min(1).max(50),
	building_name: z.string().min(1).max(200),
	building_type: z.string().max(50).default("MAIN"),

	// Location
	floor_count: z.number().int().positive().optional().nullable(),
	basement_floors: z.number().int().default(0),
	address_supplement: z.string().max(200).optional().nullable(),
	latitude: z.number().optional().nullable(),
	longitude: z.number().optional().nullable(),
	distance_from_main_meters: z.number().int().optional().nullable(),

	// Capacity
	total_rooms: z.number().int().default(0),
	total_meeting_rooms: z.number().int().default(0),
	total_outlets: z.number().int().default(0),

	// Accessibility
	wheelchair_accessible: z.boolean().default(true),
	elevator_count: z.number().int().default(0),
	service_elevator_count: z.number().int().default(0),
	stairwell_count: z.number().int().default(0),

	// Amenities
	has_lobby: z.boolean().default(false),
	has_pool: z.boolean().default(false),
	has_gym: z.boolean().default(false),
	has_spa: z.boolean().default(false),
	has_restaurant: z.boolean().default(false),
	has_bar: z.boolean().default(false),
	has_parking: z.boolean().default(false),
	parking_spaces: z.number().int().default(0),
	has_loading_dock: z.boolean().default(false),
	has_laundry: z.boolean().default(false),

	// Operating Information
	year_built: z.number().int().optional().nullable(),
	last_renovation_year: z.number().int().optional().nullable(),
	construction_type: z.string().max(100).optional().nullable(),

	// Status
	is_active: z.boolean().default(true),
	building_status: z.string().max(20).default("OPERATIONAL"),
	seasonal_open_date: z.coerce.date().optional().nullable(),
	seasonal_close_date: z.coerce.date().optional().nullable(),

	// Media
	photo_url: z.string().max(500).optional().nullable(),
	floor_plan_url: z.string().max(500).optional().nullable(),

	// Notes
	internal_notes: z.string().optional().nullable(),
	guest_description: z.string().optional().nullable(),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),

	// Optimistic Locking
	version: z.number().int().default(0),
});

export type Buildings = z.infer<typeof BuildingsSchema>;

/**
 * Schema for creating a new building
 */
export const CreateBuildingsSchema = BuildingsSchema.omit({
	building_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
	version: true,
});

export type CreateBuildings = z.infer<typeof CreateBuildingsSchema>;

/**
 * Schema for updating a building
 */
export const UpdateBuildingsSchema = BuildingsSchema.partial().omit({
	building_id: true,
	tenant_id: true,
	property_id: true,
	created_at: true,
	created_by: true,
});

export type UpdateBuildings = z.infer<typeof UpdateBuildingsSchema>;
