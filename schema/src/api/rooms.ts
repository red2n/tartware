/**
 * DEV DOC
 * Module: api/rooms.ts
 * Purpose: Room and Room Type API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// -----------------------------------------------------------------------------
// Room Type Schemas
// -----------------------------------------------------------------------------

/**
 * Room type list item schema for API responses.
 * Uses snake_case to match current API output.
 * Note: Uses room_type_id (not id) for clarity in API responses.
 */
export const RoomTypeItemSchema = z.object({
	room_type_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	type_name: z.string(),
	type_code: z.string(),
	description: z.string().optional(),
	short_description: z.string().optional(),
	category: z.string(),
	base_occupancy: z.number().int(),
	max_occupancy: z.number().int(),
	max_adults: z.number().int(),
	max_children: z.number().int().optional(),
	extra_bed_capacity: z.number().int().optional(),
	size_sqm: z.number().optional(),
	bed_type: z.string().optional(),
	number_of_beds: z.number().int().optional(),
	amenities: z.unknown().optional(),
	features: z.unknown().optional(),
	base_price: z.number(),
	currency: z.string().optional(),
	images: z.unknown().optional(),
	display_order: z.number().int().optional(),
	is_active: z.boolean(),
	metadata: z.unknown().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	version: z.string().optional(),
});

export type RoomTypeItem = z.infer<typeof RoomTypeItemSchema>;

/**
 * Create room type request body schema.
 */
export const CreateRoomTypeBodySchema = z.object({
	property_id: uuid,
	type_name: z.string().min(1).max(160),
	type_code: z.string().min(1).max(80),
	description: z.string().max(2000).optional(),
	short_description: z.string().max(500).optional(),
	category: z.string().max(80).optional(),
	base_occupancy: z.number().int().min(1).optional(),
	max_occupancy: z.number().int().min(1).optional(),
	max_adults: z.number().int().min(1).optional(),
	max_children: z.number().int().min(0).optional(),
	extra_bed_capacity: z.number().int().min(0).optional(),
	size_sqm: z.number().positive().optional(),
	bed_type: z.string().max(80).optional(),
	number_of_beds: z.number().int().min(0).optional(),
	amenities: z.unknown().optional(),
	features: z.unknown().optional(),
	base_price: z.number().nonnegative(),
	currency: z.string().length(3).optional(),
	images: z.unknown().optional(),
	display_order: z.number().int().min(0).optional(),
	is_active: z.boolean().optional(),
	metadata: z.unknown().optional(),
});

export type CreateRoomTypeBody = z.infer<typeof CreateRoomTypeBodySchema>;

/**
 * Update room type request body schema.
 */
export const UpdateRoomTypeBodySchema = CreateRoomTypeBodySchema.partial();

export type UpdateRoomTypeBody = z.infer<typeof UpdateRoomTypeBodySchema>;

/**
 * Room type list response schema.
 */
export const RoomTypeListResponseSchema = z.object({
	data: z.array(RoomTypeItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type RoomTypeListResponse = z.infer<typeof RoomTypeListResponseSchema>;

/**
 * Single room type response schema.
 */
export const RoomTypeResponseSchema = z.object({
	data: RoomTypeItemSchema,
});

export type RoomTypeResponse = z.infer<typeof RoomTypeResponseSchema>;

// -----------------------------------------------------------------------------
// Room Schemas
// -----------------------------------------------------------------------------

/**
 * Room list item schema for API responses.
 * Uses snake_case to match current API output.
 * Note: Uses room_id (not id) for clarity in API responses.
 */
export const RoomItemSchema = z.object({
	room_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	room_type_id: uuid.optional(),
	room_type_name: z.string().optional(),
	room_type_amenities: z.array(z.string()).optional(),
	room_number: z.string(),
	room_name: z.string().optional(),
	floor: z.string().optional(),
	building: z.string().optional(),
	wing: z.string().optional(),
	status: z.string(),
	status_display: z.string(),
	housekeeping_status: z.string(),
	housekeeping_display: z.string(),
	maintenance_status: z.string(),
	maintenance_display: z.string(),
	features: z.record(z.unknown()).optional(),
	amenities: z.array(z.string()).optional(),
	is_blocked: z.boolean(),
	block_reason: z.string().optional(),
	is_out_of_order: z.boolean(),
	out_of_order_reason: z.string().optional(),
	expected_ready_date: z.string().optional(),
	housekeeping_notes: z.string().optional(),
	updated_at: z.string().optional(),
	version: z.string(),
});

export type RoomItem = z.infer<typeof RoomItemSchema>;

/**
 * Create room request body schema.
 */
export const CreateRoomBodySchema = z.object({
	property_id: uuid,
	room_type_id: uuid.optional(),
	room_number: z.string().min(1).max(50),
	floor: z.string().max(20).optional(),
	wing: z.string().max(50).optional(),
	building: z.string().max(100).optional(),
	description: z.string().max(2000).optional(),
	status: z.string().max(50).optional(),
	amenities: z.unknown().optional(),
	features: z.unknown().optional(),
	notes: z.string().max(2000).optional(),
	sort_order: z.number().int().min(0).optional(),
	is_active: z.boolean().optional(),
	metadata: z.unknown().optional(),
});

export type CreateRoomBody = z.infer<typeof CreateRoomBodySchema>;

/**
 * Update room request body schema.
 */
export const UpdateRoomBodySchema = CreateRoomBodySchema.partial();

export type UpdateRoomBody = z.infer<typeof UpdateRoomBodySchema>;

/**
 * Room list response schema.
 */
export const RoomListResponseSchema = z.object({
	data: z.array(RoomItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type RoomListResponse = z.infer<typeof RoomListResponseSchema>;

/**
 * Single room response schema.
 */
export const RoomResponseSchema = z.object({
	data: RoomItemSchema,
});

export type RoomResponse = z.infer<typeof RoomResponseSchema>;
