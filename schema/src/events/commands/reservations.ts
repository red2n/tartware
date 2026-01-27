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
	"PENDING",
	"CONFIRMED",
	"CHECKED_IN",
	"CHECKED_OUT",
	"CANCELLED",
	"NO_SHOW",
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
	source: z
		.enum(["DIRECT", "WEBSITE", "PHONE", "WALKIN", "OTA", "CORPORATE", "GROUP"])
		.optional(),
	total_amount: z.coerce.number().nonnegative(),
	currency: z.string().length(3).optional(),
	notes: z.string().max(2000).optional(),
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
