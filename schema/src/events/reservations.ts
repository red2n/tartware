import { z } from "zod";

import { ReservationsSchema } from "../schemas/03-bookings/reservations.js";

/**
 * Event envelope metadata
 */
export const EventMetadataSchema = z.object({
	id: z.string().uuid(),
	source: z.string(),
	type: z.string(),
	timestamp: z.string().datetime(),
	version: z.string().default("1.0"),
	correlationId: z.string().uuid().optional(),
	tenantId: z.string().uuid(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

/**
 * Reservation Created Event
 */
const ReservationCreatePayloadSchema = z.object({
	id: ReservationsSchema.shape.id.optional(),
	property_id: ReservationsSchema.shape.property_id,
	guest_id: ReservationsSchema.shape.guest_id,
	room_type_id: ReservationsSchema.shape.room_type_id,
	rate_id: ReservationsSchema.shape.rate_id,
	rate_plan_code: z.string().max(50).optional(),
	check_in_date: z.coerce.date(),
	check_out_date: z.coerce.date(),
	booking_date: z.coerce.date().optional(),
	status: ReservationsSchema.shape.status.optional(),
	source: ReservationsSchema.shape.source.optional(),
	total_amount: z.coerce.number().nonnegative(),
	currency: ReservationsSchema.shape.currency.optional(),
	notes: ReservationsSchema.shape.internal_notes.optional(),
	fallback: z
		.object({
			requested_rate_code: z.string().optional(),
			applied_rate_code: z.string(),
			reason: z.string().optional(),
			actor: z.string(),
		})
		.optional(),
});

export const ReservationCreatedEventSchema = z.object({
	metadata: EventMetadataSchema.extend({
		type: z.literal("reservation.created"),
	}),
	payload: ReservationCreatePayloadSchema,
});

export type ReservationCreatedEvent = z.infer<typeof ReservationCreatedEventSchema>;

/**
 * Reservation Updated Event
 */
export const ReservationUpdatedEventSchema = z.object({
	metadata: EventMetadataSchema.extend({
		type: z.literal("reservation.updated"),
	}),
	payload: ReservationsSchema.partial().extend({
		id: ReservationsSchema.shape.id,
		rate_plan_code: z.string().max(50).optional(),
	}),
});

export type ReservationUpdatedEvent = z.infer<typeof ReservationUpdatedEventSchema>;

/**
 * Reservation Cancelled Event
 */
export const ReservationCancelledEventSchema = z.object({
	metadata: EventMetadataSchema.extend({
		type: z.literal("reservation.cancelled"),
	}),
	payload: z.object({
		id: ReservationsSchema.shape.id,
		tenant_id: ReservationsSchema.shape.tenant_id,
		cancelled_at: z.coerce.date(),
		cancelled_by: z.string().optional(),
		reason: z.string().optional(),
	}),
});

export type ReservationCancelledEvent = z.infer<typeof ReservationCancelledEventSchema>;

export const ReservationEventSchema = z.union([
	ReservationCreatedEventSchema,
	ReservationUpdatedEventSchema,
	ReservationCancelledEventSchema,
]);

export type ReservationEvent = z.infer<typeof ReservationEventSchema>;
