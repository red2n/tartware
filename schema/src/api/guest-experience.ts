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

/** Query schema for checkout preview lookup. */
export const CheckoutPreviewQuerySchema = z.object({
	confirmation_code: z.string().min(1),
});

export type CheckoutPreviewQuery = z.infer<typeof CheckoutPreviewQuerySchema>;

// -----------------------------------------------------------------------------
// Reward Catalog & Redemption
// -----------------------------------------------------------------------------

/** Query schema for listing reward catalog. */
export const RewardCatalogQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	tier: z.string().max(50).optional(),
	category: z.string().max(50).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});

export type RewardCatalogQuery = z.infer<typeof RewardCatalogQuerySchema>;

/** Body schema for redeeming a reward. */
export const RedeemRewardBodySchema = z.object({
	tenant_id: uuid.optional(),
	property_id: uuid,
	guest_id: uuid,
	reward_id: uuid,
	reservation_id: uuid.optional(),
});

export type RedeemRewardBody = z.infer<typeof RedeemRewardBodySchema>;

/** Query schema for listing guest redemptions. */
export const GuestRedemptionsQuerySchema = z.object({
	tenant_id: uuid,
	guest_id: uuid,
	limit: z.coerce.number().int().min(1).max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});

export type GuestRedemptionsQuery = z.infer<typeof GuestRedemptionsQuerySchema>;

// -----------------------------------------------------------------------------
// DB Row Types (internal query results)
// -----------------------------------------------------------------------------

/** Row shape from mobile_check_ins table queries. */
export const MobileCheckinRowSchema = z.object({
	mobile_checkin_id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	reservation_id: z.string(),
	guest_id: z.string(),
	checkin_status: z.string(),
	access_method: z.string(),
	checkin_started_at: z.string().nullable(),
	checkin_completed_at: z.string().nullable(),
	room_id: z.string().nullable(),
	digital_key_type: z.string().nullable(),
	digital_key_id: z.string().nullable(),
});

export type MobileCheckinRow = z.infer<typeof MobileCheckinRowSchema>;

/** Row shape from reservations table queries (checkin context). */
export const ReservationRowSchema = z.object({
	id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	guest_id: z.string(),
	confirmation_number: z.string(),
	status: z.string(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	room_number: z.string().nullable(),
	guest_first_name: z.string().nullable().optional(),
	guest_last_name: z.string().nullable().optional(),
});

export type ReservationRow = z.infer<typeof ReservationRowSchema>;

/** Row shape from mobile_keys table queries. */
export const KeyRowSchema = z.object({
	key_id: z.string(),
	key_code: z.string(),
	key_type: z.string(),
	status: z.string(),
	valid_from: z.string(),
	valid_to: z.string(),
	last_used_at: z.string().nullable(),
	usage_count: z.number(),
	room_id: z.string(),
});

export type KeyRow = z.infer<typeof KeyRowSchema>;

/** Row shape for guest data in registration card context. */
export const GuestRowSchema = z.object({
	id: z.string(),
	first_name: z.string(),
	last_name: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	date_of_birth: z.string().nullable(),
	nationality: z.string().nullable(),
	address_line_1: z.string().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	country: z.string().nullable(),
	postal_code: z.string().nullable(),
});

export type GuestRow = z.infer<typeof GuestRowSchema>;

/** Row shape for reservation detail in registration card context. */
export const ReservationDetailRowSchema = z.object({
	id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	guest_id: z.string(),
	confirmation_number: z.string(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	room_number: z.string().nullable(),
	room_type: z.string().nullable(),
	rate_id: z.string().nullable(),
	number_of_adults: z.number(),
	number_of_children: z.number(),
	number_of_nights: z.number(),
});

export type ReservationDetailRow = z.infer<typeof ReservationDetailRowSchema>;

/** Row shape for property data in registration card context. */
export const PropertyRowSchema = z.object({
	id: z.string(),
	property_name: z.string(),
	address_line_1: z.string().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	country: z.string().nullable(),
	postal_code: z.string().nullable(),
	phone: z.string().nullable(),
});

export type PropertyRow = z.infer<typeof PropertyRowSchema>;

/** Row shape from digital_registration_cards upsert. */
export const RegistrationCardRowSchema = z.object({
	registration_id: z.string(),
	registration_number: z.string(),
	pdf_url: z.string().nullable(),
});

export type RegistrationCardRow = z.infer<typeof RegistrationCardRowSchema>;

/** Data shape for rendering a registration card HTML template. */
export const CardTemplateDataSchema = z.object({
	registrationNumber: z.string(),
	propertyName: z.string(),
	propertyAddress: z.string().nullable(),
	propertyPhone: z.string().nullable(),
	guestName: z.string(),
	guestEmail: z.string().nullable(),
	guestPhone: z.string().nullable(),
	guestDob: z.string().nullable(),
	guestNationality: z.string().nullable(),
	guestAddress: z.string().nullable(),
	confirmationCode: z.string(),
	arrivalDate: z.string(),
	departureDate: z.string(),
	numberOfNights: z.number(),
	adults: z.number(),
	children: z.number(),
	roomNumber: z.string().nullable(),
	roomType: z.string().nullable(),
	rateCode: z.string().nullable(),
});

export type CardTemplateData = z.infer<typeof CardTemplateDataSchema>;

// -----------------------------------------------------------------------------
// Payment Gateway Types
// -----------------------------------------------------------------------------

export const AuthorizationResultSchema = z.object({
	authorizationId: z.string(),
	status: z.enum(["authorized", "declined"]),
	amount: z.number(),
	currency: z.string(),
});

export type AuthorizationResult = z.infer<typeof AuthorizationResultSchema>;

export const CaptureResultSchema = z.object({
	paymentId: z.string(),
	status: z.enum(["captured", "failed"]),
	amount: z.number(),
});

export type CaptureResult = z.infer<typeof CaptureResultSchema>;

export const RefundResultSchema = z.object({
	refundId: z.string(),
	status: z.enum(["refunded", "failed"]),
	amount: z.number(),
});

export type RefundResult = z.infer<typeof RefundResultSchema>;

// -----------------------------------------------------------------------------
// Mobile Check-In Service Types
// -----------------------------------------------------------------------------

/** Input for starting a mobile check-in. */
export const StartCheckinInputSchema = z.object({
	reservationId: uuid,
	tenantId: uuid,
	guestId: uuid,
	accessMethod: z.string().default("mobile_app"),
	deviceType: z.string().optional(),
	appVersion: z.string().optional(),
	initiatedBy: z.string().nullable().optional(),
});

export type StartCheckinInput = z.infer<typeof StartCheckinInputSchema>;

/** Result of starting a mobile check-in. */
export const StartCheckinResultSchema = z.object({
	mobileCheckinId: uuid,
	reservationId: uuid,
	status: z.string(),
	accessMethod: z.string(),
	startedAt: z.string().nullable(),
});

export type StartCheckinResult = z.infer<typeof StartCheckinResultSchema>;

/** Input for completing a mobile check-in. */
export const CompleteCheckinInputSchema = z.object({
	mobileCheckinId: uuid,
	identityVerificationMethod: z.string().optional(),
	idDocumentVerified: z.boolean().optional(),
	registrationCardSigned: z.boolean().optional(),
	paymentMethodVerified: z.boolean().optional(),
	termsAccepted: z.boolean().optional(),
	roomId: uuid.nullable().optional(),
	digitalKeyType: z.string().nullable().optional(),
	guestSignatureUrl: z.string().optional(),
});

export type CompleteCheckinInput = z.infer<typeof CompleteCheckinInputSchema>;

/** Result of completing a mobile check-in. */
export const CompleteCheckinResultSchema = z.object({
	mobileCheckinId: uuid,
	reservationId: uuid,
	status: z.string(),
	completedAt: z.string().nullable(),
	roomId: z.string().nullable(),
});

export type CompleteCheckinResult = z.infer<typeof CompleteCheckinResultSchema>;

// -----------------------------------------------------------------------------
// Booking Service Types
// -----------------------------------------------------------------------------

/** Input for searching room availability. */
export const SearchAvailabilityInputSchema = z.object({
	tenantId: uuid,
	propertyId: uuid,
	checkInDate: z.string(),
	checkOutDate: z.string(),
	adults: z.number().int().min(1).optional(),
	children: z.number().int().min(0).optional(),
});

export type SearchAvailabilityInput = z.infer<
	typeof SearchAvailabilityInputSchema
>;

/** Room type availability result from aggregation. */
export const AvailableRoomTypeSchema = z.object({
	roomTypeId: uuid,
	roomTypeName: z.string(),
	description: z.string().nullable(),
	maxOccupancy: z.number(),
	baseRate: z.number(),
	currency: z.string(),
	amenities: z.array(z.string()),
	availableCount: z.number(),
});

export type AvailableRoomType = z.infer<typeof AvailableRoomTypeSchema>;

/** Input for creating a direct booking. */
export const CreateBookingInputSchema = z.object({
	tenantId: uuid,
	propertyId: uuid,
	guestEmail: z.string().email(),
	guestFirstName: z.string().min(1),
	guestLastName: z.string().min(1),
	guestPhone: z.string().optional(),
	roomTypeId: uuid,
	checkInDate: z.string(),
	checkOutDate: z.string(),
	adults: z.number().int().min(1),
	children: z.number().int().min(0).optional(),
	paymentToken: z.string().optional(),
	specialRequests: z.string().optional(),
	idempotencyKey: z.string().optional(),
});

export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;

/** Result of a booking creation. */
export const BookingResultSchema = z.object({
	reservationId: uuid,
	confirmationCode: z.string(),
	status: z.string(),
	guestId: uuid,
	paymentAuthorization: AuthorizationResultSchema.optional(),
});

export type BookingResult = z.infer<typeof BookingResultSchema>;

/** Booking lookup result (guest-facing). */
export const BookingLookupResultSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	confirmation_number: z.string(),
	status: z.string(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	room_number: z.string().nullable(),
	number_of_adults: z.number(),
	number_of_children: z.number(),
	first_name: z.string(),
	last_name: z.string(),
	email: z.string(),
	property_name: z.string(),
});

export type BookingLookupResult = z.infer<typeof BookingLookupResultSchema>;

/** Formatted booking lookup response (guest-facing endpoint). */
export const BookingLookupResponseSchema = z.object({
	reservationId: uuid,
	confirmationCode: z.string(),
	status: z.string(),
	propertyName: z.string(),
	guestName: z.string(),
	checkInDate: z.string(),
	checkOutDate: z.string(),
	adults: z.number(),
	children: z.number(),
});

export type BookingLookupResponse = z.infer<typeof BookingLookupResponseSchema>;

// -----------------------------------------------------------------------------
// Registration Card Types
// -----------------------------------------------------------------------------

/** Input for generating a registration card. */
export const GenerateCardInputSchema = z.object({
	reservationId: uuid,
	tenantId: uuid,
	mobileCheckinId: uuid.nullable().optional(),
	initiatedBy: z.string().nullable().optional(),
});

export type GenerateCardInput = z.infer<typeof GenerateCardInputSchema>;

/** Registration card output data. */
export const RegistrationCardDataSchema = z.object({
	registrationId: uuid,
	registrationNumber: z.string(),
	property: z.object({
		name: z.string(),
		address: z.string().nullable(),
		phone: z.string().nullable(),
	}),
	guest: z.object({
		fullName: z.string(),
		email: z.string().nullable(),
		phone: z.string().nullable(),
		dateOfBirth: z.string().nullable(),
		nationality: z.string().nullable(),
		address: z.string().nullable(),
	}),
	stay: z.object({
		confirmationCode: z.string(),
		arrivalDate: z.string(),
		departureDate: z.string(),
		numberOfNights: z.number(),
		adults: z.number(),
		children: z.number(),
		roomNumber: z.string().nullable(),
		roomType: z.string().nullable(),
		rateCode: z.string().nullable(),
	}),
	html: z.string(),
});

export type RegistrationCardData = z.infer<typeof RegistrationCardDataSchema>;

// -----------------------------------------------------------------------------
// Mobile Key Types
// -----------------------------------------------------------------------------

/** Mobile key details. */
export const MobileKeySchema = z.object({
	keyId: uuid,
	keyCode: z.string(),
	keyType: z.enum(["bluetooth", "nfc", "qr_code", "pin"]),
	status: z.enum(["pending", "active", "expired", "revoked", "used"]),
	validFrom: z.coerce.date(),
	validTo: z.coerce.date(),
});

export type MobileKey = z.infer<typeof MobileKeySchema>;

/** Mobile key status query result. */
export const KeyStatusSchema = z.object({
	keyId: uuid,
	status: MobileKeySchema.shape.status,
	lastUsedAt: z.coerce.date().nullable(),
	usageCount: z.number().int(),
});

export type KeyStatus = z.infer<typeof KeyStatusSchema>;

// =============================================================================
// GUEST EXPERIENCE — provider contracts (DI interfaces)
// =============================================================================

/**
 * Payment gateway abstraction.
 * Real implementations connect to Stripe, Adyen, WIMO, etc.
 */
export interface PaymentGateway {
	/** Pre-authorize a payment amount. */
	authorize(amount: number, currency: string, token: string): Promise<AuthorizationResult>;
	/** Capture a previously authorized payment. */
	capture(authorizationId: string): Promise<CaptureResult>;
	/** Refund a captured payment (full or partial). */
	refund(paymentId: string, amount: number): Promise<RefundResult>;
}

/**
 * Key card / mobile key vendor abstraction.
 * Real implementations connect to ASSA ABLOY Vostio, Salto KS, Dormakaba, etc.
 */
export interface KeyVendor {
	/** Issue a new digital key for a room. */
	issueKey(params: {
		roomId: string;
		guestId: string;
		validFrom: Date;
		validTo: Date;
		keyType?: MobileKey["keyType"];
	}): Promise<MobileKey>;
	/** Revoke an existing key. */
	revokeKey(keyId: string): Promise<void>;
}
