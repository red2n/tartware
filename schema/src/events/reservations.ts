/**
 * DEV DOC
 * Module: events/reservations.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { ReservationsSchema } from "../schemas/03-bookings/reservations.js";

const RateCodeSchema = z
	.string()
	.min(2)
	.max(50)
	.regex(/^[A-Z0-9_-]+$/i, "Rate code must be alphanumeric with - or _");

const FailureCauseSchema = z.object({
	name: z.string().optional(),
	message: z.string(),
	stack: z.string().optional(),
	origin: z.string().optional(),
});

const RateFallbackMetadataSchema = z.object({
	requestedCode: RateCodeSchema.optional(),
	appliedCode: RateCodeSchema,
	reason: z.string().optional(),
	decidedBy: z.string(),
	decidedAt: z.string().datetime(),
});

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
	retryCount: z.number().int().nonnegative().default(0),
	attemptedAt: z.string().datetime().optional(),
	failureCause: FailureCauseSchema.optional(),
	rateFallback: RateFallbackMetadataSchema.optional(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;
export type FailureCause = z.infer<typeof FailureCauseSchema>;

/**
 * Reservation Created Event
 */
const ReservationCreatePayloadSchema = z.object({
	id: ReservationsSchema.shape.id.optional(),
	property_id: ReservationsSchema.shape.property_id,
	guest_id: ReservationsSchema.shape.guest_id,
	room_type_id: ReservationsSchema.shape.room_type_id,
	rate_code: RateCodeSchema.optional(),
	check_in_date: z.coerce.date(),
	check_out_date: z.coerce.date(),
	booking_date: z.coerce.date().optional(),
	status: ReservationsSchema.shape.status.optional(),
	source: ReservationsSchema.shape.source.optional(),
	reservation_type: ReservationsSchema.shape.reservation_type,
	total_amount: z.coerce.number().nonnegative(),
	currency: ReservationsSchema.shape.currency.optional(),
	notes: ReservationsSchema.shape.internal_notes.optional(),
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
		rate_code: RateCodeSchema.optional(),
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
		cancellation_fee: z.coerce.number().nonnegative().optional(),
	}),
});

export type ReservationCancelledEvent = z.infer<typeof ReservationCancelledEventSchema>;

export const ReservationEventSchema = z.union([
	ReservationCreatedEventSchema,
	ReservationUpdatedEventSchema,
	ReservationCancelledEventSchema,
]);

export type ReservationEvent = z.infer<typeof ReservationEventSchema>;
