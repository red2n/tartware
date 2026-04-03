/**
 * DEV DOC
 * Module: api/buildings.ts
 * Purpose: Building API request/response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// -----------------------------------------------------------------------------
// Building Schemas
// -----------------------------------------------------------------------------

/**
 * Building list item schema for API responses.
 * Uses snake_case to match current API output.
 */
export const BuildingItemSchema = z.object({
	building_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	building_code: z.string(),
	building_name: z.string(),
	building_type: z.string(),
	floor_count: z.number().int().nullable().optional(),
	basement_floors: z.number().int().optional(),
	total_rooms: z.number().int().optional(),
	wheelchair_accessible: z.boolean().optional(),
	elevator_count: z.number().int().optional(),
	has_lobby: z.boolean().optional(),
	has_pool: z.boolean().optional(),
	has_gym: z.boolean().optional(),
	has_spa: z.boolean().optional(),
	has_restaurant: z.boolean().optional(),
	has_parking: z.boolean().optional(),
	parking_spaces: z.number().int().optional(),
	year_built: z.number().int().nullable().optional(),
	last_renovation_year: z.number().int().nullable().optional(),
	is_active: z.boolean(),
	building_status: z.string(),
	photo_url: z.string().nullable().optional(),
	guest_description: z.string().nullable().optional(),
	internal_notes: z.string().nullable().optional(),
	metadata: z.unknown().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	version: z.string().optional(),
});

export type BuildingItem = z.infer<typeof BuildingItemSchema>;

/**
 * Create building request body schema.
 */
export const CreateBuildingBodySchema = z.object({
	property_id: uuid,
	building_code: z
		.string()
		.min(1)
		.max(50)
		.regex(/^[A-Za-z0-9_-]+$/, {
			message: "Building code must be alphanumeric (with _ or -)",
		})
		.transform((v) => v.toUpperCase()),
	building_name: z.string().min(1).max(200),
	building_type: z.string().max(50).optional(),
	floor_count: z.number().int().positive().optional(),
	basement_floors: z.number().int().min(0).optional(),
	total_rooms: z.number().int().min(0).optional(),
	wheelchair_accessible: z.boolean().optional(),
	elevator_count: z.number().int().min(0).optional(),
	has_lobby: z.boolean().optional(),
	has_pool: z.boolean().optional(),
	has_gym: z.boolean().optional(),
	has_spa: z.boolean().optional(),
	has_restaurant: z.boolean().optional(),
	has_parking: z.boolean().optional(),
	parking_spaces: z.number().int().min(0).optional(),
	year_built: z.number().int().optional(),
	last_renovation_year: z.number().int().optional(),
	is_active: z.boolean().optional(),
	building_status: z.string().max(20).optional(),
	photo_url: z.string().max(500).optional(),
	guest_description: z.string().optional(),
	internal_notes: z.string().optional(),
	metadata: z.unknown().optional(),
});

export type CreateBuildingBody = z.infer<typeof CreateBuildingBodySchema>;

/**
 * Update building request body schema.
 */
export const UpdateBuildingBodySchema = CreateBuildingBodySchema.partial();

export type UpdateBuildingBody = z.infer<typeof UpdateBuildingBodySchema>;

// -----------------------------------------------------------------------------
// Service-Layer Input Types
// -----------------------------------------------------------------------------

/** Service-layer input for creating a building (includes tenant_id and created_by). */
export const CreateBuildingInputSchema = CreateBuildingBodySchema.extend({
	tenant_id: uuid,
	created_by: z.string().optional(),
});

export type CreateBuildingInput = z.infer<typeof CreateBuildingInputSchema>;

/** Service-layer input for updating a building (includes tenant_id, building_id, updated_by). */
export const UpdateBuildingInputSchema = UpdateBuildingBodySchema.extend({
	tenant_id: uuid,
	building_id: uuid,
	updated_by: z.string().optional(),
});

export type UpdateBuildingInput = z.infer<typeof UpdateBuildingInputSchema>;

/**
 * Building list query schema.
 */
export const BuildingListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	is_active: z.coerce.boolean().optional(),
	building_type: z.string().max(50).optional(),
	search: z.string().min(1).max(80).optional(),
	limit: z.coerce.number().int().positive().max(500).default(200),
	offset: z.coerce.number().int().min(0).default(0),
});

export type BuildingListQuery = z.infer<typeof BuildingListQuerySchema>;

/**
 * Building list response schema.
 */
export const BuildingListResponseSchema = z.object({
	data: z.array(BuildingItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type BuildingListResponse = z.infer<typeof BuildingListResponseSchema>;

/**
 * Single building response schema.
 */
export const BuildingResponseSchema = z.object({
	data: BuildingItemSchema,
});

export type BuildingResponse = z.infer<typeof BuildingResponseSchema>;
