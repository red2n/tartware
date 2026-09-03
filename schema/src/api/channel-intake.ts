/**
 * DEV DOC
 * Module: api/channel-intake.ts
 * Purpose: The inbound half of the channel contract — what a channel manager
 *          posts when a booking is made on an OTA, and the closed vocabulary
 *          the queue that holds it moves through.
 * Ownership: Schema package
 *
 * Separate from `api/channel-transport.ts` because the two halves have
 * different shapes and different failure modes: outbound is a provider
 * interface Tartware calls, inbound is a payload Tartware is handed by an
 * untrusted caller and must validate before it touches anything.
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// ---------------------------------------------------------------------------
// Queue vocabulary
// ---------------------------------------------------------------------------

/**
 * `ota_reservations_queue.status`.
 *
 * This enum exists because the column was `z.string()` in the schema and plain
 * `VARCHAR` with no CHECK in the DDL, and the two ends of the system had
 * quietly picked different words for the same five states. The table defaults
 * `status` to `'PENDING'` and carries three partial indexes — described in
 * their own file as "critical for queue processing" — on `'PENDING'`,
 * `'PROCESSING'` and `'FAILED'`. The only reader queried `'pending'`,
 * `'processing'`, `'completed'`. So the indexes could not serve the one query
 * that drains the queue, and a row inserted with the documented default would
 * never have been seen by it.
 *
 * Uppercase wins because the DDL, the default and the indexes are three votes
 * against the reader's one.
 */
export const OtaQueueStatusEnum = z.enum([
	"PENDING", // received from the channel, not yet drained
	"PROCESSING", // a reservation command has been accepted for it
	"COMPLETED", // the reservation exists and the queue row points at it
	"FAILED", // could not be turned into a booking; error_message says why
	"DUPLICATE", // the channel sent a booking that was already ingested
]);
export type OtaQueueStatus = z.infer<typeof OtaQueueStatusEnum>;

// ---------------------------------------------------------------------------
// Inbound booking payload
// ---------------------------------------------------------------------------

/**
 * One booking as a channel reports it.
 *
 * Everything here is the channel's vocabulary, not Tartware's: `room_type` is
 * the channel's own room code and is resolved through `channel_mappings`, and
 * `ota_reservation_id` is the channel's identifier for the booking — the key
 * redelivery is deduplicated on.
 *
 * There is deliberately no `guest_id`, no `room_type_id` and no `status`: a
 * caller that could name an internal guest or set a booking's status would be
 * writing Tartware's records rather than reporting its own.
 */
export const OtaReservationIntakeSchema = z.object({
	/** The channel's identifier for this booking. Unique per channel. */
	ota_reservation_id: z.string().min(1).max(100),
	ota_booking_reference: z.string().max(100).optional(),
	guest_name: z.string().min(1).max(200),
	guest_email: z.string().email().max(255).optional(),
	guest_phone: z.string().max(50).optional(),
	check_in_date: z.coerce.date(),
	check_out_date: z.coerce.date(),
	/** The channel's room-type code, resolved through `channel_mappings`. */
	room_type: z.string().min(1).max(100),
	number_of_guests: z.number().int().positive().max(20).optional(),
	total_amount: z.coerce.number().nonnegative(),
	currency_code: z.string().length(3).optional(),
	special_requests: z.string().max(2000).optional(),
	/** The channel's own message, kept verbatim for dispute and replay. */
	raw_payload: z.record(z.unknown()).optional(),
});
export type OtaReservationIntake = z.infer<typeof OtaReservationIntakeSchema>;

/** The whole inbound request: one or more bookings from one channel. */
export const OtaReservationIntakeRequestSchema = z.object({
	property_id: uuid,
	reservations: z.array(OtaReservationIntakeSchema).min(1).max(100),
});
export type OtaReservationIntakeRequest = z.infer<
	typeof OtaReservationIntakeRequestSchema
>;

/** What the ingress reports back per booking. */
export const OtaReservationIntakeResultSchema = z.object({
	ota_reservation_id: z.string(),
	queue_id: uuid,
	/**
	 * True when this booking was already in the queue. A redelivery is answered
	 * with the row it already produced rather than a second one — the channel
	 * gets the same 202 either way, because a channel that is told "duplicate"
	 * as an error will keep retrying.
	 */
	duplicate: z.boolean(),
});
export type OtaReservationIntakeResult = z.infer<
	typeof OtaReservationIntakeResultSchema
>;

/**
 * Header the channel's HMAC-SHA256 signature arrives in, matching the payment
 * gateway webhook this ingress is modelled on.
 */
export const CHANNEL_SIGNATURE_HEADER = "x-channel-signature";
