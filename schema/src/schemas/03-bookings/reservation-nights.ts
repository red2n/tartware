/**
 * DEV DOC
 * Module: schemas/03-bookings/reservation-nights.ts
 * Description: ReservationNights Schema
 * Table: reservation_nights
 * Category: 03-bookings
 * Primary exports: ReservationNightsSchema, CreateReservationNightsSchema, UpdateReservationNightsSchema
 * @table reservation_nights
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * ReservationNights Schema
 *
 * One row per room per night — the per-night price ledger of a stay. This is
 * what makes a split-rate stay expressible: night 1 and night 3 of the same
 * room can carry different rates, and the stay window is `MIN(stay_date)` to
 * `MAX(stay_date) + 1`. Every price read moves off `reservations.room_rate`
 * onto a SUM over this table.
 *
 * `stay_date` is the night the guest sleeps, so a 3-night stay arriving on the
 * 10th has rows for the 10th, 11th and 12th — never the departure date.
 *
 * @table reservation_nights
 * @category 03-bookings
 * @synchronized 2026-08-27
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete ReservationNights schema
 */
export const ReservationNightsSchema = z.object({
	reservation_night_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	/** Denormalised from reservation_rooms so stay-date sweeps skip a join. */
	reservation_id: uuid,
	reservation_room_id: uuid,
	/** The night occupied — never the departure date. */
	stay_date: z.coerce.date(),
	rate_id: uuid.optional(),
	/** Rate code snapshot; survives a later rename of the rate plan. */
	rate_code: z.string().optional(),
	rate_amount: money,
	currency: z.string(),
	adults: z.number().int().nonnegative().optional(),
	children: z.number().int().nonnegative().optional(),
	/** Comped night: occupies inventory, posts nothing. */
	is_complimentary: z.boolean().optional(),
	/** Set when a user priced this night by hand instead of taking the rate. */
	is_rate_override: z.boolean().optional(),
	rate_override_reason: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ReservationNights = z.infer<typeof ReservationNightsSchema>;

/**
 * Schema for creating a new reservation night.
 */
export const CreateReservationNightsSchema = ReservationNightsSchema.omit({
	reservation_night_id: true,
	created_at: true,
	updated_at: true,
	updated_by: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
}).extend({
	reservation_night_id: uuid.optional(),
});

export type CreateReservationNights = z.infer<
	typeof CreateReservationNightsSchema
>;

/**
 * Schema for updating a reservation night
 */
export const UpdateReservationNightsSchema = ReservationNightsSchema.partial();

export type UpdateReservationNights = z.infer<
	typeof UpdateReservationNightsSchema
>;
