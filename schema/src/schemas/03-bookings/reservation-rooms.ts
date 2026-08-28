/**
 * DEV DOC
 * Module: schemas/03-bookings/reservation-rooms.ts
 * Description: ReservationRooms Schema
 * Table: reservation_rooms
 * Category: 03-bookings
 * Primary exports: ReservationRoomsSchema, CreateReservationRoomsSchema, UpdateReservationRoomsSchema
 * @table reservation_rooms
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * ReservationRooms Schema
 *
 * One row per physical room held by a reservation. Before this table a
 * reservation carried a single `room_id`/`room_type_id`, which made a
 * multi-room booking impossible to express. `reservations` keeps the guest,
 * the guarantee and the confirmation number; everything room-shaped lives
 * here, and everything price-shaped lives on `reservation_nights`.
 *
 * @table reservation_rooms
 * @category 03-bookings
 * @synchronized 2026-08-27
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Lifecycle of a single room within a reservation. Tracked per room because a
 * three-room booking can have one room checked in and two still due to arrive.
 */
export const ReservationRoomStatusEnum = z.enum([
	"PENDING",
	"CONFIRMED",
	"CHECKED_IN",
	"CHECKED_OUT",
	"CANCELLED",
	"NO_SHOW",
]);

export type ReservationRoomStatus = z.infer<typeof ReservationRoomStatusEnum>;

/**
 * Complete ReservationRooms schema
 */
export const ReservationRoomsSchema = z.object({
	reservation_room_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	/** 1-based position within the reservation — "Room 2 of 3". */
	room_sequence: z.number().int().positive(),
	room_type_id: uuid,
	/** Assigned room (rooms.id); NULL until a specific room is allocated. */
	room_id: uuid.optional(),
	/** Snapshot of the assigned room number, for display without a join. */
	room_number: z.string().optional(),
	/** Primary occupant of this room; may differ from reservations.guest_id. */
	guest_id: uuid.optional(),
	adults: z.number().int().nonnegative(),
	children: z.number().int().nonnegative().optional(),
	infants: z.number().int().nonnegative().optional(),
	/** Blocks room-move and auto-assign from relocating this room. */
	do_not_move: z.boolean().optional(),
	status: ReservationRoomStatusEnum,
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ReservationRooms = z.infer<typeof ReservationRoomsSchema>;

/**
 * Schema for creating a new reservation room.
 *
 * Omits identifiers and audit columns the database assigns.
 */
export const CreateReservationRoomsSchema = ReservationRoomsSchema.omit({
	reservation_room_id: true,
	created_at: true,
	updated_at: true,
	updated_by: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
}).extend({
	reservation_room_id: uuid.optional(),
	status: ReservationRoomStatusEnum.optional(),
});

export type CreateReservationRooms = z.infer<
	typeof CreateReservationRoomsSchema
>;

/**
 * Schema for updating a reservation room
 */
export const UpdateReservationRoomsSchema = ReservationRoomsSchema.partial();

export type UpdateReservationRooms = z.infer<
	typeof UpdateReservationRoomsSchema
>;
