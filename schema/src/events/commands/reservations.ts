/**
 * DEV DOC
 * Module: events/commands/reservations.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

const RateCodeSchema = z
	.string()
	.min(2)
	.max(50)
	.regex(/^[A-Z0-9_-]+$/i, "Rate code must be alphanumeric with - or _");

const ReservationStatusEnum = z.enum([
	"INQUIRY",
	"QUOTED",
	"PENDING",
	"CONFIRMED",
	"WAITLISTED",
	"CHECKED_IN",
	"CHECKED_OUT",
	"CANCELLED",
	"NO_SHOW",
	"EXPIRED",
]);

export const ReservationCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	room_type_id: z.string().uuid(),
	check_in_date: z.coerce.date(),
	check_out_date: z.coerce.date(),
	booking_date: z.coerce.date().optional(),
	status: ReservationStatusEnum.optional(),
	rate_code: RateCodeSchema.optional(),
	// MED-007: Require explicit opt-in for rate fallback
	// When requested rate is unavailable, fallback to BAR/RACK only if this is true
	allow_rate_fallback: z.boolean().optional(),
	source: z
		.enum(["DIRECT", "WEBSITE", "PHONE", "WALKIN", "OTA", "CORPORATE", "GROUP"])
		.optional(),
	reservation_type: z
		.enum(["TRANSIENT", "CORPORATE", "GROUP", "WHOLESALE", "PACKAGE", "COMPLIMENTARY", "HOUSE_USE", "DAY_USE", "WAITLIST"])
		.optional(),
	total_amount: z.coerce.number().nonnegative(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	eta: z.string().regex(/^\d{2}:\d{2}$/, "ETA must be HH:MM format").optional(),
	company_id: z.string().uuid().optional(),
	travel_agent_id: z.string().uuid().optional(),
});

export type ReservationCreateCommand = z.infer<
	typeof ReservationCreateCommandSchema
>;

export const ReservationModifyCommandSchema = z
	.object({
		reservation_id: z.string().uuid(),
		property_id: z.string().uuid().optional(),
		guest_id: z.string().uuid().optional(),
		room_type_id: z.string().uuid().optional(),
		check_in_date: z.coerce.date().optional(),
		check_out_date: z.coerce.date().optional(),
		booking_date: z.coerce.date().optional(),
		status: ReservationStatusEnum.optional(),
		rate_code: RateCodeSchema.optional(),
		// MED-007: Require explicit opt-in for rate fallback
		allow_rate_fallback: z.boolean().optional(),
		total_amount: z.coerce.number().nonnegative().optional(),
		currency: z.string().length(3).optional(),
		notes: z.string().max(2000).optional(),
	})
	.refine(
		(value) =>
			Boolean(
				value.property_id ||
					value.guest_id ||
					value.room_type_id ||
					value.check_in_date ||
					value.check_out_date ||
					value.booking_date ||
					value.status ||
					value.total_amount ||
					value.currency ||
					value.notes,
			),
		"At least one field must be provided to modify the reservation",
	);

export type ReservationModifyCommand = z.infer<
	typeof ReservationModifyCommandSchema
>;

export const ReservationCancelCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	property_id: z.string().uuid().optional(),
	reason: z.string().max(500).optional(),
	cancelled_by: z.string().uuid().optional(),
});

export type ReservationCancelCommand = z.infer<
	typeof ReservationCancelCommandSchema
>;

export const ReservationCheckInCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	room_id: z.string().uuid().optional(),
	checked_in_at: z.coerce.date().optional(),
	/** When true, bypass blocking deposit enforcement. */
	force: z.boolean().optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationCheckInCommand = z.infer<
	typeof ReservationCheckInCommandSchema
>;

export const ReservationCheckOutCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	checked_out_at: z.coerce.date().optional(),
	force: z.boolean().optional(),
	express: z.boolean().optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationCheckOutCommand = z.infer<
	typeof ReservationCheckOutCommandSchema
>;

export const ReservationAssignRoomCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	room_id: z.string().uuid(),
	assigned_at: z.coerce.date().optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationAssignRoomCommand = z.infer<
	typeof ReservationAssignRoomCommandSchema
>;

export const ReservationUnassignRoomCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationUnassignRoomCommand = z.infer<
	typeof ReservationUnassignRoomCommandSchema
>;

export const ReservationExtendStayCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	new_check_out_date: z.coerce.date(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationExtendStayCommand = z.infer<
	typeof ReservationExtendStayCommandSchema
>;

export const ReservationRateOverrideCommandSchema = z
	.object({
		reservation_id: z.string().uuid(),
		rate_code: RateCodeSchema.optional(),
		total_amount: z.coerce.number().nonnegative().optional(),
		currency: z.string().length(3).optional(),
		reason: z.string().max(500).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) =>
			Boolean(
				value.rate_code ||
					typeof value.total_amount === "number" ||
					value.currency,
			),
		"rate_code, total_amount, or currency is required",
	);

export type ReservationRateOverrideCommand = z.infer<
	typeof ReservationRateOverrideCommandSchema
>;

export const ReservationDepositAddCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	method: z.string().max(50).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationDepositAddCommand = z.infer<
	typeof ReservationDepositAddCommandSchema
>;

export const ReservationDepositReleaseCommandSchema = z
	.object({
		reservation_id: z.string().uuid(),
		deposit_id: z.string().uuid().optional(),
		amount: z.coerce.number().positive().optional(),
		reason: z.string().max(500).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.deposit_id || value.amount),
		"deposit_id or amount is required",
	);

export type ReservationDepositReleaseCommand = z.infer<
	typeof ReservationDepositReleaseCommandSchema
>;

/**
 * Mark a reservation as no-show. Applies when a guest fails to arrive
 * by the cutoff time on the check-in date.
 */
export const ReservationNoShowCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	no_show_fee: z.coerce.number().nonnegative().optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationNoShowCommand = z.infer<
	typeof ReservationNoShowCommandSchema
>;

/**
 * Batch no-show sweep: finds all PENDING/CONFIRMED reservations whose
 * check-in date has passed for the given property and marks each as no-show.
 * Delegates to the individual `markNoShow` handler per reservation so that
 * outbox events, room releases, and fee calculations are applied consistently.
 */
export const ReservationBatchNoShowCommandSchema = z.object({
	property_id: z.string().uuid(),
	/** Business date to evaluate against (defaults to today). */
	business_date: z.coerce.date().optional(),
	/** Whether to skip actually marking no-shows and just return the candidates. */
	dry_run: z.boolean().optional(),
	/** Override fee applied to each no-show (otherwise defaults to one-night room rate). */
	no_show_fee_override: z.coerce.number().nonnegative().optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationBatchNoShowCommand = z.infer<
	typeof ReservationBatchNoShowCommandSchema
>;

/**
 * Walk-in express check-in: creates a reservation, assigns a room, and checks
 * in the guest in a single atomic operation. Used for walk-in guests at the
 * front desk who need immediate accommodation.
 */
export const ReservationWalkInCheckInCommandSchema = z.object({
	property_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	room_type_id: z.string().uuid(),
	room_id: z.string().uuid().optional(),
	check_out_date: z.coerce.date(),
	rate_code: RateCodeSchema.optional(),
	allow_rate_fallback: z.boolean().optional(),
	total_amount: z.coerce.number().nonnegative(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	eta: z.string().regex(/^\d{2}:\d{2}$/, "ETA must be HH:MM format").optional(),
	company_id: z.string().uuid().optional(),
	travel_agent_id: z.string().uuid().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationWalkInCheckInCommand = z.infer<
	typeof ReservationWalkInCheckInCommandSchema
>;

/**
 * Add a guest to the waitlist for a sold-out date/room type.
 * Creates a waitlist_entries row with priority scoring.
 */
export const ReservationWaitlistAddCommandSchema = z.object({
	property_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	requested_room_type_id: z.string().uuid(),
	requested_rate_id: z.string().uuid().optional(),
	arrival_date: z.coerce.date(),
	departure_date: z.coerce.date(),
	number_of_rooms: z.coerce.number().int().positive().optional(),
	number_of_adults: z.coerce.number().int().positive().optional(),
	number_of_children: z.coerce.number().int().nonnegative().optional(),
	flexibility: z.enum(["NONE", "DATE", "ROOM_TYPE", "EITHER"]).optional(),
	vip_flag: z.boolean().optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationWaitlistAddCommand = z.infer<
	typeof ReservationWaitlistAddCommandSchema
>;

/**
 * Convert a waitlist entry into a confirmed reservation.
 * Marks the waitlist entry as CONFIRMED and creates a new reservation.
 */
export const ReservationWaitlistConvertCommandSchema = z.object({
	waitlist_id: z.string().uuid(),
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid().optional(),
	rate_code: RateCodeSchema.optional(),
	allow_rate_fallback: z.boolean().optional(),
	total_amount: z.coerce.number().nonnegative(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationWaitlistConvertCommand = z.infer<
	typeof ReservationWaitlistConvertCommandSchema
>;

/**
 * Send a quote to a guest for an INQUIRY reservation.
 * Transitions status from INQUIRY to QUOTED and records the quote
 * expiry date so it can be auto-expired later.
 */
export const ReservationSendQuoteCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	quote_expires_at: z.coerce.date().optional(),
	total_amount: z.coerce.number().nonnegative().optional(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationSendQuoteCommand = z.infer<
	typeof ReservationSendQuoteCommandSchema
>;

/**
 * Convert a QUOTED reservation into a PENDING booking.
 * Transitions status from QUOTED to PENDING and locks availability.
 */
export const ReservationConvertQuoteCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	total_amount: z.coerce.number().nonnegative().optional(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationConvertQuoteCommand = z.infer<
	typeof ReservationConvertQuoteCommandSchema
>;

/**
 * Expire a reservation. Transitions INQUIRY, QUOTED, or PENDING
 * reservations to EXPIRED status, releasing any availability holds.
 */
export const ReservationExpireCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationExpireCommand = z.infer<
	typeof ReservationExpireCommandSchema
>;

/**
 * Walk a guest: relocate to an alternate hotel due to overbooking.
 * Creates a walk_history record and transitions reservation status.
 */
export const ReservationWalkGuestCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	walk_reason: z.string().max(500).optional(),
	alternate_hotel_name: z.string().max(255).optional(),
	alternate_hotel_address: z.string().max(500).optional(),
	alternate_hotel_phone: z.string().max(50).optional(),
	alternate_confirmation: z.string().max(100).optional(),
	alternate_rate: z.number().nonnegative().optional(),
	alternate_nights: z.number().int().min(1).default(1),
	compensation_type: z.enum([
		"first_night_covered",
		"full_stay_covered",
		"rate_discount",
		"loyalty_points",
		"future_credit",
		"cash",
		"other",
	]).optional(),
	compensation_amount: z.number().nonnegative().default(0),
	compensation_description: z.string().max(500).optional(),
	transportation_provided: z.boolean().default(false),
	transportation_type: z.string().max(50).optional(),
	transportation_cost: z.number().nonnegative().default(0),
	return_guaranteed: z.boolean().default(false),
	return_date: z.coerce.date().optional(),
	return_room_type: z.string().max(100).optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ReservationWalkGuestCommand = z.infer<
	typeof ReservationWalkGuestCommandSchema
>;
