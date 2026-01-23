/**
 * DEV DOC
 * Module: schemas/03-bookings/reservation-rate-fallbacks.ts
 * Description: Reservation Rate Fallbacks Schema
 * Table: reservation_rate_fallbacks
 * Category: 03-bookings
 * Primary exports: ReservationRateFallbacksSchema, CreateReservationRateFallbacksSchema, UpdateReservationRateFallbacksSchema
 * @table reservation_rate_fallbacks
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Reservation Rate Fallbacks Schema
 * @table reservation_rate_fallbacks
 * @category 03-bookings
 * @synchronized 2025-12-26
 *
 * Captures audit events for BAR/RACK fallback decisions.
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

const RateCodeSchema = z
	.string()
	.min(2)
	.max(50)
	.regex(/^[A-Z0-9_-]+$/i);

export const ReservationRateFallbacksSchema = z.object({
	id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	reservation_id: uuid,
	property_id: uuid,
	requested_rate_code: RateCodeSchema.optional(),
	applied_rate_code: RateCodeSchema,
	reason: z.string().max(200).optional(),
	actor: z.string().max(150),
	correlation_id: uuid.optional(),
	metadata: jsonbMetadata,
	created_at: z.coerce.date(),
});

export type ReservationRateFallbacks = z.infer<
	typeof ReservationRateFallbacksSchema
>;

export const CreateReservationRateFallbacksSchema =
	ReservationRateFallbacksSchema.omit({
		id: true,
		created_at: true,
	});

export type CreateReservationRateFallbacks = z.infer<
	typeof CreateReservationRateFallbacksSchema
>;

export const UpdateReservationRateFallbacksSchema =
	ReservationRateFallbacksSchema.partial().extend({
		id: uuid,
	});

export type UpdateReservationRateFallbacks = z.infer<
	typeof UpdateReservationRateFallbacksSchema
>;
