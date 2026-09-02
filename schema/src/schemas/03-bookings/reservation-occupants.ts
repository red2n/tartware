/**
 * DEV DOC
 * Module: schemas/03-bookings/reservation-occupants.ts
 * Description: ReservationOccupants Schema
 * Table: reservation_occupants
 * Category: 03-bookings
 * Primary exports: ReservationOccupantsSchema, CreateReservationOccupantsSchema, UpdateReservationOccupantsSchema
 * @table reservation_occupants
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * ReservationOccupants Schema
 *
 * Named people sleeping in a given `reservation_rooms` row. The reservation's
 * own `guest_id` is the booker; this table is who actually occupies each room,
 * which is what registration cards, accompanying-guest capture and share
 * reservations all need.
 *
 * An occupant may be an anonymous name (no profile yet) — `guest_id` is
 * optional and `full_name` is the fallback identity.
 *
 * @table reservation_occupants
 * @category 03-bookings
 * @synchronized 2026-08-27
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Occupancy class of a named occupant. Drives per-person pricing and the
 * adults/children counts held on the room row.
 */
export const ReservationOccupantTypeEnum = z.enum(["ADULT", "CHILD", "INFANT"]);

export type ReservationOccupantType = z.infer<
	typeof ReservationOccupantTypeEnum
>;

/**
 * Complete ReservationOccupants schema
 */
export const ReservationOccupantsSchema = z.object({
	occupant_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	reservation_room_id: uuid,
	/** Linked guest profile; absent for a name-only accompanying guest. */
	guest_id: uuid.optional(),
	full_name: z.string(),
	occupant_type: ReservationOccupantTypeEnum,
	/** Age at check-in, where captured — child rates depend on it. */
	age: z.number().int().nonnegative().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	/** Exactly one occupant per room may be primary. */
	is_primary: z.boolean(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ReservationOccupants = z.infer<typeof ReservationOccupantsSchema>;

/**
 * Schema for creating a new reservation occupant.
 */
export const CreateReservationOccupantsSchema = ReservationOccupantsSchema.omit(
	{
		occupant_id: true,
		created_at: true,
		updated_at: true,
		updated_by: true,
		is_deleted: true,
		deleted_at: true,
		deleted_by: true,
	},
).extend({
	occupant_id: uuid.optional(),
	is_primary: z.boolean().optional(),
});

export type CreateReservationOccupants = z.infer<
	typeof CreateReservationOccupantsSchema
>;

/**
 * Schema for updating a reservation occupant
 */
export const UpdateReservationOccupantsSchema =
	ReservationOccupantsSchema.partial();

export type UpdateReservationOccupants = z.infer<
	typeof UpdateReservationOccupantsSchema
>;
