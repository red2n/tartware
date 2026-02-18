/**
 * DEV DOC
 * Module: schemas/02-inventory/room-availability.ts
 * Description: RoomAvailability Schema
 * Table: room_availability
 * Category: 02-inventory
 * Primary exports: RoomAvailabilitySchema, CreateRoomAvailabilitySchema, UpdateRoomAvailabilitySchema
 * @table room_availability
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * RoomAvailability Schema
 * @table room_availability
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import { jsonbMetadata, money, uuid } from "../../shared/base-schemas.js";
import { AvailabilityStatusEnum } from "../../shared/enums.js";

/**
 * Complete RoomAvailability schema
 */
export const RoomAvailabilitySchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	availability_date: z.coerce.date(),
	total_rooms: z.number().int().nonnegative().default(0),
	available_rooms: z.number().int().nonnegative().default(0),
	reserved_rooms: z.number().int().nonnegative().default(0),
	blocked_rooms: z.number().int().nonnegative().default(0),
	out_of_order_rooms: z.number().int().nonnegative().default(0),
	base_price: money.optional(),
	dynamic_price: money.optional(),
	currency: z.string().length(3).optional(),
	min_length_of_stay: z.number().int().positive().optional(),
	max_length_of_stay: z.number().int().positive().optional(),
	closed_to_arrival: z.boolean().optional(),
	closed_to_departure: z.boolean().optional(),
	stop_sell: z.boolean().optional(),
	status: AvailabilityStatusEnum,
	metadata: jsonbMetadata,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().max(100).optional(),
	updated_by: z.string().max(100).optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	version: z.bigint().default(BigInt(0)),
});

export type RoomAvailability = z.infer<typeof RoomAvailabilitySchema>;

/**
 * Schema for creating a new room availability
 */
export const CreateRoomAvailabilitySchema = RoomAvailabilitySchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateRoomAvailability = z.infer<
	typeof CreateRoomAvailabilitySchema
>;

/**
 * Schema for updating a room availability
 */
export const UpdateRoomAvailabilitySchema = RoomAvailabilitySchema.partial();

export type UpdateRoomAvailability = z.infer<
	typeof UpdateRoomAvailabilitySchema
>;
