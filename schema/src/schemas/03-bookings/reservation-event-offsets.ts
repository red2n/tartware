/**
 * DEV DOC
 * Module: schemas/03-bookings/reservation-event-offsets.ts
 * Description: Reservation Event Offsets Schema
 * Table: reservation_event_offsets
 * Category: 03-bookings
 * Primary exports: ReservationEventOffsetsSchema, CreateReservationEventOffsetsSchema, UpdateReservationEventOffsetsSchema
 * @table reservation_event_offsets
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Reservation Event Offsets Schema
 * @table reservation_event_offsets
 * @category 03-bookings
 * @synchronized 2025-12-15
 *
 * Purpose: Persist Kafka offsets + idempotency markers for resilient consumers
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

export const ReservationEventOffsetsSchema = z.object({
	id: z.bigint(),
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	consumer_group: z.string(),
	topic: z.string(),
	partition: z.number().int(),
	last_processed_offset: z.bigint(),
	last_event_id: uuid.optional(),
	reservation_id: uuid.optional(),
	correlation_id: uuid.optional(),
	processed_at: z.date(),
	metadata: jsonbMetadata,
	created_at: z.date(),
	updated_at: z.date().optional(),
});

export type ReservationEventOffsets = z.infer<
	typeof ReservationEventOffsetsSchema
>;

export const CreateReservationEventOffsetsSchema =
	ReservationEventOffsetsSchema.omit({
		id: true,
		processed_at: true,
		created_at: true,
		updated_at: true,
	});
export type CreateReservationEventOffsets = z.infer<
	typeof CreateReservationEventOffsetsSchema
>;

export const UpdateReservationEventOffsetsSchema =
	ReservationEventOffsetsSchema.partial().extend({
		id: z.bigint(),
	});
export type UpdateReservationEventOffsets = z.infer<
	typeof UpdateReservationEventOffsetsSchema
>;
