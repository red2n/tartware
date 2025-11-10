/**
 * Rooms Schema
 * @table rooms
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid } from "../../shared/base-schemas.js";
import {
	RoomStatusEnum,
	HousekeepingStatusEnum,
	MaintenanceStatusEnum,
} from "../../shared/enums.js";

/**
 * Complete Rooms schema
 */
export const RoomsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	room_number: z.string(),
	room_name: z.string().optional(),
	floor: z.string().optional(),
	building: z.string().optional(),
	wing: z.string().optional(),
	status: RoomStatusEnum,
	housekeeping_status: HousekeepingStatusEnum,
	maintenance_status: MaintenanceStatusEnum,
	features: z.record(z.unknown()).optional(),
	amenities: z.record(z.unknown()).optional(),
	is_blocked: z.boolean().optional(),
	block_reason: z.string().optional(),
	blocked_from: z.coerce.date().optional(),
	blocked_until: z.coerce.date().optional(),
	is_out_of_order: z.boolean().optional(),
	out_of_order_reason: z.string().optional(),
	out_of_order_since: z.coerce.date().optional(),
	expected_ready_date: z.coerce.date().optional(),
	notes: z.string().optional(),
	housekeeping_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
	version: z.bigint().optional(),
});

export type Rooms = z.infer<typeof RoomsSchema>;

/**
 * Schema for creating a new rooms
 */
export const CreateRoomsSchema = RoomsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateRooms = z.infer<typeof CreateRoomsSchema>;

/**
 * Schema for updating a rooms
 */
export const UpdateRoomsSchema = RoomsSchema.partial();

export type UpdateRooms = z.infer<typeof UpdateRoomsSchema>;
