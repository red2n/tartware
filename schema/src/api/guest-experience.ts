/**
 * DEV DOC
 * Module: api/guest-experience.ts
 * Purpose: Guest self-service API request schemas (S17, S27, S28, S30)
 * Ownership: Schema package
 */

import { z } from "zod";

import { isoDateString, uuid } from "../shared/base-schemas.js";

// -----------------------------------------------------------------------------
// S30 — Direct Booking: Search & Book
// -----------------------------------------------------------------------------

/** Query schema for availability search (self-service). */
export const GuestBookingSearchQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	check_in_date: isoDateString,
	check_out_date: isoDateString,
	adults: z.coerce.number().int().min(1).default(1),
	children: z.coerce.number().int().min(0).default(0),
});

export type GuestBookingSearchQuery = z.infer<
	typeof GuestBookingSearchQuerySchema
>;

/** Body schema for creating a direct booking (self-service). */
export const GuestBookingBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	guest_email: z.string().email(),
	guest_first_name: z.string().min(1).max(100),
	guest_last_name: z.string().min(1).max(100),
	guest_phone: z.string().max(50).optional(),
	room_type_id: uuid,
	check_in_date: isoDateString,
	check_out_date: isoDateString,
	adults: z.number().int().min(1),
	children: z.number().int().min(0).default(0),
	payment_token: z.string().optional(),
	special_requests: z.string().max(1000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type GuestBookingBody = z.infer<typeof GuestBookingBodySchema>;

/** Params schema for booking lookup by confirmation code. */
export const ConfirmationCodeParamsSchema = z.object({
	confirmationCode: z.string().min(1).max(50),
});

export type ConfirmationCodeParams = z.infer<
	typeof ConfirmationCodeParamsSchema
>;

// -----------------------------------------------------------------------------
// S17 — Mobile Check-In
// -----------------------------------------------------------------------------

/** Body schema for starting a mobile check-in. */
export const StartCheckinBodySchema = z.object({
	confirmation_code: z.string().min(1).max(50),
	access_method: z
		.enum([
			"mobile_app",
			"web_browser",
			"kiosk",
			"sms_link",
			"email_link",
			"qr_code",
		])
		.default("mobile_app"),
	device_type: z.string().max(50).optional(),
	app_version: z.string().max(20).optional(),
});

export type StartCheckinBody = z.infer<typeof StartCheckinBodySchema>;

/** Body schema for completing a mobile check-in. */
export const CompleteCheckinBodySchema = z.object({
	identity_verification_method: z
		.enum([
			"government_id",
			"passport",
			"drivers_license",
			"face_recognition",
			"biometric",
			"existing_profile",
			"manual_verification",
			"not_required",
		])
		.default("existing_profile"),
	id_document_verified: z.boolean().default(false),
	registration_card_signed: z.boolean().default(false),
	payment_method_verified: z.boolean().default(false),
	terms_accepted: z.boolean().default(false),
	room_id: uuid.optional(),
	digital_key_type: z
		.enum([
			"mobile_app_key",
			"nfc",
			"bluetooth",
			"qr_code",
			"pin_code",
			"physical_key_required",
		])
		.optional(),
	guest_signature_url: z.string().url().optional(),
});

export type CompleteCheckinBody = z.infer<typeof CompleteCheckinBodySchema>;

/** Params schema for reservation ID in URL. */
export const ReservationIdParamsSchema = z.object({
	reservationId: uuid,
});

export type ReservationIdParams = z.infer<typeof ReservationIdParamsSchema>;

/** Params schema for check-in ID in URL. */
export const CheckinIdParamsSchema = z.object({
	checkinId: uuid,
});

export type CheckinIdParams = z.infer<typeof CheckinIdParamsSchema>;

// -----------------------------------------------------------------------------
// S28 — Mobile Keys
// -----------------------------------------------------------------------------

/** Query schema for mobile key lookup. */
export const MobileKeysQuerySchema = z.object({
	tenant_id: uuid,
});

export type MobileKeysQuery = z.infer<typeof MobileKeysQuerySchema>;

// -----------------------------------------------------------------------------
// S27 — Registration Card
// -----------------------------------------------------------------------------

/** Query schema for registration card generation. */
export const GenerateCardQuerySchema = z.object({
	tenant_id: uuid,
	mobile_checkin_id: uuid.optional(),
});

export type GenerateCardQuery = z.infer<typeof GenerateCardQuerySchema>;

// -----------------------------------------------------------------------------
// Self-Service Checkout
// -----------------------------------------------------------------------------

/** Body schema for initiating a self-service checkout. */
export const CheckoutStartBodySchema = z.object({
	confirmation_code: z.string().min(1),
	express: z.boolean().default(true),
	notes: z.string().max(500).optional(),
});

export type CheckoutStartBody = z.infer<typeof CheckoutStartBodySchema>;
