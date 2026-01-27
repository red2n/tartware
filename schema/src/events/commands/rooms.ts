/**
 * DEV DOC
 * Module: events/commands/rooms.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	HousekeepingStatusEnum,
	MaintenanceStatusEnum,
	RoomStatusEnum,
} from "../../shared/enums.js";

export const RoomInventoryBlockCommandSchema = z.object({
	room_id: z.string().uuid(),
	action: z.enum(["block", "release"]).default("block"),
	reason: z.string().min(1).max(255).optional(),
	blocked_from: z.coerce.date().optional(),
	blocked_until: z.coerce.date().optional(),
	expected_ready_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type RoomInventoryBlockCommand = z.infer<
	typeof RoomInventoryBlockCommandSchema
>;

export const RoomInventoryReleaseCommandSchema = z.object({
	room_id: z.string().uuid(),
	reason: z.string().min(1).max(255).optional(),
	released_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RoomInventoryReleaseCommand = z.infer<
	typeof RoomInventoryReleaseCommandSchema
>;

export const RoomStatusUpdateCommandSchema = z
	.object({
		room_id: z.string().uuid(),
		status: RoomStatusEnum.optional(),
		maintenance_status: MaintenanceStatusEnum.optional(),
		reason: z.string().max(500).optional(),
		notes: z.string().max(2000).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.status || value.maintenance_status),
		"status or maintenance_status is required",
	);

export type RoomStatusUpdateCommand = z.infer<
	typeof RoomStatusUpdateCommandSchema
>;

export const RoomHousekeepingStatusUpdateCommandSchema = z.object({
	room_id: z.string().uuid(),
	housekeeping_status: HousekeepingStatusEnum,
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RoomHousekeepingStatusUpdateCommand = z.infer<
	typeof RoomHousekeepingStatusUpdateCommandSchema
>;

export const RoomOutOfOrderCommandSchema = z.object({
	room_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	out_of_order_since: z.coerce.date().optional(),
	expected_ready_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RoomOutOfOrderCommand = z.infer<
	typeof RoomOutOfOrderCommandSchema
>;

export const RoomOutOfServiceCommandSchema = z.object({
	room_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	out_of_service_from: z.coerce.date().optional(),
	out_of_service_until: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RoomOutOfServiceCommand = z.infer<
	typeof RoomOutOfServiceCommandSchema
>;

export const RoomMoveCommandSchema = z.object({
	from_room_id: z.string().uuid(),
	to_room_id: z.string().uuid(),
	reservation_id: z.string().uuid().optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RoomMoveCommand = z.infer<typeof RoomMoveCommandSchema>;

export const RoomFeaturesUpdateCommandSchema = z
	.object({
		room_id: z.string().uuid(),
		features: z.record(z.unknown()).optional(),
		amenities: z.record(z.unknown()).optional(),
		notes: z.string().max(2000).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.features || value.amenities || value.notes),
		"features, amenities, or notes is required",
	);

export type RoomFeaturesUpdateCommand = z.infer<
	typeof RoomFeaturesUpdateCommandSchema
>;
