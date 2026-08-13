/**
 * DEV DOC
 * Module: api/events.ts
 * Purpose: Meeting room and event booking API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// Note: CompanyTypeEnum and CompanyCreditStatusEnum are available from @tartware/schemas
// via the shared/enums.ts export (do not re-define here to avoid naming conflicts)

// =====================================================
// MEETING ROOMS
// =====================================================

/**
 * Meeting room type enum matching database constraints.
 */
export const MeetingRoomTypeEnum = z.enum([
	"BALLROOM",
	"CONFERENCE",
	"BOARDROOM",
	"MEETING",
	"BANQUET",
	"EXHIBITION",
	"OUTDOOR",
	"THEATER",
	"CLASSROOM",
	"FLEXIBLE",
]);
export type MeetingRoomType = z.infer<typeof MeetingRoomTypeEnum>;

/**
 * Meeting room status enum matching database constraints.
 */
export const MeetingRoomStatusEnum = z.enum([
	"AVAILABLE",
	"OCCUPIED",
	"MAINTENANCE",
	"BLOCKED",
	"OUT_OF_ORDER",
]);
export type MeetingRoomStatus = z.infer<typeof MeetingRoomStatusEnum>;

/**
 * Meeting room list item schema for API responses.
 */
export const MeetingRoomListItemSchema = z.object({
	room_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),

	// Room Information
	room_code: z.string(),
	room_name: z.string(),
	room_type: z.string(),
	room_type_display: z.string(),
	room_status: z.string(),
	room_status_display: z.string(),

	// Location
	building: z.string().nullable(),
	floor: z.number().int().nullable(),
	location_description: z.string().nullable(),

	// Capacity
	max_capacity: z.number().int(),
	theater_capacity: z.number().int().nullable(),
	classroom_capacity: z.number().int().nullable(),
	banquet_capacity: z.number().int().nullable(),
	reception_capacity: z.number().int().nullable(),
	u_shape_capacity: z.number().int().nullable(),
	boardroom_capacity: z.number().int().nullable(),

	// Physical Dimensions
	area_sqm: z.number().nullable(),
	area_sqft: z.number().nullable(),
	length_meters: z.number().nullable(),
	width_meters: z.number().nullable(),
	ceiling_height_meters: z.number().nullable(),

	// Key Features
	has_natural_light: z.boolean(),
	has_audio_visual: z.boolean(),
	has_video_conferencing: z.boolean(),
	has_wifi: z.boolean(),
	has_stage: z.boolean(),
	has_dance_floor: z.boolean(),
	wheelchair_accessible: z.boolean(),

	// Setup
	default_setup: z.string().nullable(),
	setup_time_minutes: z.number().int(),
	teardown_time_minutes: z.number().int(),
	turnover_time_minutes: z.number().int(),

	// Pricing
	hourly_rate: z.number().nullable(),
	half_day_rate: z.number().nullable(),
	full_day_rate: z.number().nullable(),
	minimum_rental_hours: z.number().int(),
	currency_code: z.string(),

	// Operating Hours
	operating_hours_start: z.string().nullable(),
	operating_hours_end: z.string().nullable(),

	// Catering
	catering_required: z.boolean(),
	in_house_catering_available: z.boolean(),
	external_catering_allowed: z.boolean(),

	// Media
	primary_photo_url: z.string().nullable(),
	floor_plan_url: z.string().nullable(),
	virtual_tour_url: z.string().nullable(),

	// Status
	is_active: z.boolean(),
	requires_approval: z.boolean(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type MeetingRoomListItem = z.infer<typeof MeetingRoomListItemSchema>;

/**
 * Meeting room list response schema.
 */
export const MeetingRoomListResponseSchema = z.object({
	data: z.array(MeetingRoomListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type MeetingRoomListResponse = z.infer<
	typeof MeetingRoomListResponseSchema
>;

// =====================================================
// EVENT BOOKINGS
// =====================================================

/**
 * Event type enum matching database constraints.
 */
export const EventTypeEnum = z.enum([
	"MEETING",
	"CONFERENCE",
	"WEDDING",
	"BANQUET",
	"TRAINING",
	"WORKSHOP",
	"RECEPTION",
	"SEMINAR",
	"TRADE_SHOW",
	"PARTY",
	"FUNDRAISER",
	"EXHIBITION",
	"OTHER",
]);
export type EventType = z.infer<typeof EventTypeEnum>;

/**
 * Event booking status enum matching database constraints.
 */
export const EventBookingStatusEnum = z.enum([
	"INQUIRY",
	"TENTATIVE",
	"DEFINITE",
	"CONFIRMED",
	"IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
	"NO_SHOW",
]);
export type EventBookingStatus = z.infer<typeof EventBookingStatusEnum>;

/**
 * Event setup type enum matching database constraints.
 */
export const EventSetupTypeEnum = z.enum([
	"THEATER",
	"CLASSROOM",
	"BANQUET",
	"RECEPTION",
	"U_SHAPE",
	"HOLLOW_SQUARE",
	"BOARDROOM",
	"CABARET",
	"COCKTAIL",
	"CUSTOM",
]);
export type EventSetupType = z.infer<typeof EventSetupTypeEnum>;

/**
 * Event booking list item schema for API responses.
 */
export const EventBookingListItemSchema = z.object({
	event_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),

	// Event Information
	event_number: z.string().nullable(),
	event_name: z.string(),
	event_type: z.string(),
	event_type_display: z.string(),

	// Meeting Room
	meeting_room_id: uuid,
	meeting_room_name: z.string().optional(),

	// Date & Time
	event_date: z.string(),
	start_time: z.string(),
	end_time: z.string(),
	setup_start_time: z.string().nullable(),
	actual_start_time: z.string().nullable(),
	actual_end_time: z.string().nullable(),

	// Organizer
	organizer_name: z.string(),
	organizer_company: z.string().nullable(),
	organizer_email: z.string().nullable(),
	organizer_phone: z.string().nullable(),

	// Linked Entities
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	company_id: uuid.optional(),

	// Attendance
	expected_attendees: z.number().int(),
	confirmed_attendees: z.number().int().nullable(),
	actual_attendees: z.number().int().nullable(),
	guarantee_number: z.number().int().nullable(),

	// Setup
	setup_type: z.string(),
	setup_type_display: z.string(),
	catering_required: z.boolean(),
	audio_visual_needed: z.boolean(),

	// Status
	booking_status: z.string(),
	booking_status_display: z.string(),
	payment_status: z.string(),
	payment_status_display: z.string(),

	// Key Dates
	booked_date: z.string(),
	confirmed_date: z.string().nullable(),
	beo_due_date: z.string().nullable(),
	final_count_due_date: z.string().nullable(),

	// Financial
	rental_rate: z.number().nullable(),
	estimated_total: z.number().nullable(),
	actual_total: z.number().nullable(),
	deposit_required: z.number().nullable(),
	deposit_paid: z.number().nullable(),
	currency_code: z.string(),

	// Documents
	contract_signed: z.boolean(),
	beo_pdf_url: z.string().nullable(),

	// Performance
	post_event_rating: z.number().int().nullable(),
	attendee_satisfaction_score: z.number().nullable(),

	// Flags
	is_recurring: z.boolean(),
	followup_required: z.boolean(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type EventBookingListItem = z.infer<typeof EventBookingListItemSchema>;

/**
 * Event booking list response schema.
 */
export const EventBookingListResponseSchema = z.object({
	data: z.array(EventBookingListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type EventBookingListResponse = z.infer<
	typeof EventBookingListResponseSchema
>;

// =====================================================
// COMPANIES (B2B Corporate Accounts)
// =====================================================

// CompanyTypeEnum and CompanyCreditStatusEnum are imported from shared/enums.ts
// (already exported from shared index - do not re-export to avoid naming conflicts)

/**
 * Company list item schema for API responses.
 */
export const CompanyListItemSchema = z.object({
	company_id: uuid,
	tenant_id: uuid,

	// Company Information
	company_name: z.string(),
	legal_name: z.string().nullable(),
	company_code: z.string().nullable(),
	company_type: z.string(),
	company_type_display: z.string(),

	// Contact
	primary_contact_name: z.string().nullable(),
	primary_contact_email: z.string().nullable(),
	primary_contact_phone: z.string().nullable(),
	billing_contact_name: z.string().nullable(),
	billing_contact_email: z.string().nullable(),

	// Address
	city: z.string().nullable(),
	state_province: z.string().nullable(),
	country: z.string().nullable(),

	// Financial
	credit_limit: z.number(),
	current_balance: z.number(),
	payment_terms: z.number().int(),
	payment_terms_type: z.string(),
	credit_status: z.string(),
	credit_status_display: z.string(),

	// Commission & Pricing
	commission_rate: z.number(),
	commission_type: z.string().nullable(),
	preferred_rate_code: z.string().nullable(),
	discount_percentage: z.number(),

	// Tax
	tax_id: z.string().nullable(),
	tax_exempt: z.boolean(),

	// Contract
	contract_number: z.string().nullable(),
	contract_start_date: z.string().nullable(),
	contract_end_date: z.string().nullable(),
	contract_status: z.string().nullable(),

	// Industry IDs
	iata_number: z.string().nullable(),
	arc_number: z.string().nullable(),

	// Performance
	total_bookings: z.number().int(),
	total_revenue: z.number(),
	average_booking_value: z.number().nullable(),
	last_booking_date: z.string().nullable(),

	// Status
	is_active: z.boolean(),
	is_vip: z.boolean(),
	is_blacklisted: z.boolean(),
	requires_approval: z.boolean(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type CompanyListItem = z.infer<typeof CompanyListItemSchema>;

/**
 * Company list response schema.
 */
export const CompanyListResponseSchema = z.object({
	data: z.array(CompanyListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;

// =====================================================
// WAITLIST ENTRIES
// =====================================================

/**
 * Waitlist status enum matching database constraints.
 */
export const WaitlistStatusEnum = z.enum([
	"ACTIVE",
	"OFFERED",
	"CONFIRMED",
	"EXPIRED",
	"CANCELLED",
]);
export type WaitlistStatus = z.infer<typeof WaitlistStatusEnum>;

/**
 * Waitlist flexibility enum matching database constraints.
 */
export const WaitlistFlexibilityEnum = z.enum([
	"NONE",
	"DATE",
	"ROOM_TYPE",
	"EITHER",
]);
export type WaitlistFlexibility = z.infer<typeof WaitlistFlexibilityEnum>;

/**
 * Waitlist entry list item schema for API responses.
 */
export const WaitlistEntryListItemSchema = z.object({
	waitlist_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),

	// Guest
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),

	// Reservation Context
	reservation_id: uuid.optional(),
	requested_room_type_id: uuid.optional(),
	room_type_name: z.string().optional(),
	requested_rate_id: uuid.optional(),

	// Stay Details
	arrival_date: z.string(),
	departure_date: z.string(),
	nights: z.number().int(),
	number_of_rooms: z.number().int(),
	number_of_adults: z.number().int(),
	number_of_children: z.number().int(),
	flexibility: z.string(),
	flexibility_display: z.string(),

	// Priority
	waitlist_status: z.string(),
	waitlist_status_display: z.string(),
	priority_score: z.number().int(),
	vip_flag: z.boolean(),

	// Notifications
	last_notified_at: z.string().optional(),
	last_notified_via: z.string().nullable(),
	offer_expiration_at: z.string().optional(),
	offer_response: z.string().nullable(),
	offer_response_at: z.string().optional(),

	// Notes
	notes: z.string().nullable(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type WaitlistEntryListItem = z.infer<typeof WaitlistEntryListItemSchema>;

/**
 * Waitlist entry list response schema.
 */
export const WaitlistEntryListResponseSchema = z.object({
	data: z.array(WaitlistEntryListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type WaitlistEntryListResponse = z.infer<
	typeof WaitlistEntryListResponseSchema
>;

// =====================================================
// GROUP BOOKINGS
// =====================================================

/**
 * Group booking status enum matching database constraints.
 */
export const GroupBookingStatusEnum = z.enum([
	"inquiry",
	"prospect",
	"tentative",
	"definite",
	"confirmed",
	"cancelled",
	"turndown",
	"completed",
]);
export type GroupBookingStatus = z.infer<typeof GroupBookingStatusEnum>;

// Note: GroupBookingTypeEnum is exported from shared/enums.ts

/**
 * Group booking list item schema for API responses.
 */
export const GroupBookingListItemSchema = z.object({
	group_booking_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),

	// Group Information
	group_name: z.string(),
	group_code: z.string().nullable(),
	group_type: z.string(),
	group_type_display: z.string(),
	block_status: z.string(),
	block_status_display: z.string(),

	// Company/Organization
	company_id: uuid.optional(),
	company_name: z.string().optional(),
	organization_name: z.string().nullable(),

	// Event Context
	event_name: z.string().nullable(),
	event_type: z.string().nullable(),

	// Contact
	contact_name: z.string(),
	contact_email: z.string().nullable(),
	contact_phone: z.string().nullable(),

	// Stay Details
	arrival_date: z.string(),
	departure_date: z.string(),
	number_of_nights: z.number().int(),

	// Room Tracking
	total_rooms_requested: z.number().int(),
	total_rooms_blocked: z.number().int(),
	total_rooms_picked: z.number().int(),
	total_rooms_confirmed: z.number().int(),
	pickup_percentage: z.number(),

	// Cutoff
	cutoff_date: z.string(),
	cutoff_days_before_arrival: z.number().int().nullable(),
	release_unsold_rooms: z.boolean(),

	// Rooming List
	rooming_list_received: z.boolean(),
	rooming_list_deadline: z.string().nullable(),

	// Financial
	deposit_amount: z.string().nullable(),
	deposit_received: z.boolean(),
	negotiated_rate: z.string().nullable(),
	estimated_total_revenue: z.string().nullable(),
	actual_revenue: z.string().nullable(),

	// Status
	contract_signed: z.boolean(),
	is_active: z.boolean(),
	booking_confidence: z.string().nullable(),

	// Manager
	account_manager_id: uuid.optional(),
	account_manager_name: z.string().optional(),
	sales_manager_id: uuid.optional(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type GroupBookingListItem = z.infer<typeof GroupBookingListItemSchema>;

/**
 * A single room-type/date block held against a group booking.
 */
export const GroupRoomBlockSchema = z.object({
	block_id: z.string(),
	room_type_id: z.string(),
	room_type_name: z.string().optional(),
	block_date: z.string(),
	blocked_rooms: z.number().int().nonnegative(),
	picked_rooms: z.number().int().nonnegative(),
	confirmed_rooms: z.number().int().nonnegative(),
	negotiated_rate: z.number().nullable(),
	rack_rate: z.number().nullable(),
	discount_percentage: z.number().nullable(),
	block_status: z.string(),
});

export type GroupRoomBlock = z.infer<typeof GroupRoomBlockSchema>;

/**
 * Group booking detail schema — the list item plus the room blocks held
 * against it. The blocks are the reason a detail view exists at all: the list
 * projection deliberately omits them because they are unbounded per booking.
 */
export const GroupBookingDetailSchema = GroupBookingListItemSchema.extend({
	room_blocks: z.array(GroupRoomBlockSchema),
});

export type GroupBookingDetail = z.infer<typeof GroupBookingDetailSchema>;

/**
 * Group booking list response schema.
 */
export const GroupBookingListResponseSchema = z.object({
	data: z.array(GroupBookingListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type GroupBookingListResponse = z.infer<
	typeof GroupBookingListResponseSchema
>;

// =====================================================
// PROMOTIONAL CODES
// =====================================================

/**
 * Promotional code status, matching the `promotional_codes.promo_status` CHECK
 * constraint.
 *
 * The previous definition here was UPPERCASE with two values the constraint
 * rejects (`INACTIVE`, `SUSPENDED`) and three missing that it accepts (`draft`,
 * `paused`, `cancelled`). Nothing read it, so it was corrected rather than kept.
 * Same drift as `CompanyTypeEnum`, `LostFoundStatusEnum` and
 * `ShiftHandoverStatusEnum` — see ui-gaps/16-booking-reference-data.md.
 */
export const PromotionalCodeStatusEnum = z.enum([
	"draft",
	"scheduled",
	"active",
	"paused",
	"expired",
	"depleted",
	"cancelled",
]);
export type PromotionalCodeStatus = z.infer<typeof PromotionalCodeStatusEnum>;

/**
 * Promotional code discount type, matching the `discount_type` CHECK constraint.
 * Note `free_night` is singular in the constraint; the old enum said
 * `FREE_NIGHTS` and added an `AMENITY` value the constraint does not allow.
 */
export const PromotionalCodeDiscountTypeEnum = z.enum([
	"percentage",
	"fixed_amount",
	"free_night",
	"upgrade",
	"other",
]);
export type PromotionalCodeDiscountType = z.infer<
	typeof PromotionalCodeDiscountTypeEnum
>;

/** Promo type, matching the `promo_type` CHECK constraint. */
export const PromotionalCodeTypeEnum = z.enum([
	"discount_percent",
	"discount_fixed",
	"free_night",
	"free_upgrade",
	"free_service",
	"bonus_points",
	"bundle_deal",
	"early_bird",
	"last_minute",
	"other",
]);
export type PromotionalCodeType = z.infer<typeof PromotionalCodeTypeEnum>;

/**
 * Promotional code list item schema for API responses.
 */
export const PromotionalCodeListItemSchema = z.object({
	promo_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	property_name: z.string().optional(),

	// Code Info
	promo_code: z.string(),
	promo_name: z.string(),
	promo_description: z.string().nullable(),
	promo_type: z.string().nullable(),
	promo_status: z.string(),
	promo_status_display: z.string(),

	// Validity
	is_active: z.boolean(),
	is_public: z.boolean(),
	valid_from: z.string(),
	valid_to: z.string(),

	// Discount
	discount_type: z.string().nullable(),
	discount_type_display: z.string().nullable(),
	discount_percent: z.string().nullable(),
	discount_amount: z.string().nullable(),
	discount_currency: z.string().nullable(),
	max_discount_amount: z.string().nullable(),
	free_nights_count: z.number().int().nullable(),

	// Usage Limits
	has_usage_limit: z.boolean(),
	total_usage_limit: z.number().int().nullable(),
	usage_count: z.number().int(),
	remaining_uses: z.number().int().nullable(),
	per_user_limit: z.number().int().nullable(),

	// Stay Restrictions
	minimum_stay_nights: z.number().int().nullable(),
	maximum_stay_nights: z.number().int().nullable(),
	minimum_booking_amount: z.string().nullable(),

	// Analytics
	times_viewed: z.number().int(),
	times_applied: z.number().int(),
	times_redeemed: z.number().int(),
	total_discount_given: z.string().nullable(),
	total_revenue_generated: z.string().nullable(),
	conversion_rate: z.string().nullable(),

	// Flags
	combinable_with_other_promos: z.boolean(),
	auto_apply: z.boolean(),
	display_on_website: z.boolean(),
	requires_approval: z.boolean(),

	// Campaign
	campaign_id: uuid.optional(),
	marketing_source: z.string().nullable(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type PromotionalCodeListItem = z.infer<
	typeof PromotionalCodeListItemSchema
>;

/**
 * Create a promotional code.
 *
 * `POST /v1/promo-codes/validate` has always worked, so codes could be *used*
 * and never *created* — the redemption path was live over a table only SQL could
 * populate. See ui-gaps/16-booking-reference-data.md.
 *
 * Usage counters (`usage_count`, `times_redeemed`, `total_discount_given` and
 * the rest of the analytics block) are machine-maintained and deliberately not
 * settable: a caller-supplied redemption count is how a limit stops meaning
 * anything.
 */
export const PromotionalCodeWriteBodySchema = z
	.object({
		tenant_id: uuid,
		property_id: uuid.optional(),
		promo_code: z
			.string()
			.min(2)
			.max(100)
			// Codes are typed by guests and pasted from emails; folding case and
			// rejecting spaces at the edge avoids "SUMMER20" and "summer20 " being
			// two different rows that both look right in a list.
			.regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only")
			.transform((value) => value.toUpperCase()),
		promo_name: z.string().min(1).max(255),
		promo_description: z.string().optional(),
		promo_type: PromotionalCodeTypeEnum.optional(),
		promo_status: PromotionalCodeStatusEnum.optional(),
		is_active: z.boolean().optional(),
		is_public: z.boolean().optional(),
		valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		discount_type: PromotionalCodeDiscountTypeEnum.optional(),
		discount_percent: z.coerce.number().min(0).max(100).optional(),
		discount_amount: z.coerce.number().nonnegative().optional(),
		discount_currency: z.string().length(3).optional(),
		max_discount_amount: z.coerce.number().nonnegative().optional(),
		free_nights_count: z.coerce.number().int().positive().optional(),
		has_usage_limit: z.boolean().optional(),
		total_usage_limit: z.coerce.number().int().positive().optional(),
		per_user_limit: z.coerce.number().int().positive().optional(),
		minimum_stay_nights: z.coerce.number().int().positive().optional(),
		maximum_stay_nights: z.coerce.number().int().positive().optional(),
		minimum_booking_amount: z.coerce.number().nonnegative().optional(),
		combinable_with_other_promos: z.boolean().optional(),
		auto_apply: z.boolean().optional(),
		display_on_website: z.boolean().optional(),
	})
	.refine((body) => body.valid_to >= body.valid_from, {
		message: "valid_to must not be before valid_from",
		path: ["valid_to"],
	})
	.refine(
		(body) => body.discount_type !== "percentage" || body.discount_percent != null,
		{ message: "discount_percent is required for a percentage discount", path: ["discount_percent"] },
	)
	.refine(
		(body) => body.discount_type !== "fixed_amount" || body.discount_amount != null,
		{ message: "discount_amount is required for a fixed-amount discount", path: ["discount_amount"] },
	)
	.refine((body) => !body.has_usage_limit || body.total_usage_limit != null, {
		message: "total_usage_limit is required when has_usage_limit is set",
		path: ["total_usage_limit"],
	});

export type PromotionalCodeWriteBody = z.infer<
	typeof PromotionalCodeWriteBodySchema
>;

/**
 * Edit a promotional code. `promo_code` is not settable: it is the identifier
 * guests already hold, and rewriting it silently invalidates every email and
 * landing page carrying the old one. Withdraw the code and issue a new one.
 */
export const PromotionalCodeUpdateBodySchema = z.object({
	tenant_id: uuid,
	promo_name: z.string().min(1).max(255).optional(),
	promo_description: z.string().optional(),
	promo_type: PromotionalCodeTypeEnum.optional(),
	promo_status: PromotionalCodeStatusEnum.optional(),
	is_active: z.boolean().optional(),
	is_public: z.boolean().optional(),
	valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	discount_type: PromotionalCodeDiscountTypeEnum.optional(),
	discount_percent: z.coerce.number().min(0).max(100).optional(),
	discount_amount: z.coerce.number().nonnegative().optional(),
	discount_currency: z.string().length(3).optional(),
	max_discount_amount: z.coerce.number().nonnegative().optional(),
	free_nights_count: z.coerce.number().int().positive().optional(),
	has_usage_limit: z.boolean().optional(),
	total_usage_limit: z.coerce.number().int().positive().optional(),
	per_user_limit: z.coerce.number().int().positive().optional(),
	minimum_stay_nights: z.coerce.number().int().positive().optional(),
	maximum_stay_nights: z.coerce.number().int().positive().optional(),
	minimum_booking_amount: z.coerce.number().nonnegative().optional(),
	combinable_with_other_promos: z.boolean().optional(),
	auto_apply: z.boolean().optional(),
	display_on_website: z.boolean().optional(),
});

export type PromotionalCodeUpdateBody = z.infer<
	typeof PromotionalCodeUpdateBodySchema
>;

/**
 * Service-layer input for a promotional code write. Camel-cased counterpart of
 * {@link PromotionalCodeWriteBodySchema}; lives here because AGENTS.md requires
 * service-layer shapes in the schema package, not in a service file.
 */
export type PromotionalCodeWriteInput = {
	promoCode: string;
	promoName: string;
	validFrom: string;
	validTo: string;
	propertyId?: string;
	promoDescription?: string;
	promoType?: string;
	promoStatus?: string;
	isActive?: boolean;
	isPublic?: boolean;
	discountType?: string;
	discountPercent?: number;
	discountAmount?: number;
	discountCurrency?: string;
	maxDiscountAmount?: number;
	freeNightsCount?: number;
	hasUsageLimit?: boolean;
	totalUsageLimit?: number;
	perUserLimit?: number;
	minimumStayNights?: number;
	maximumStayNights?: number;
	minimumBookingAmount?: number;
	combinableWithOtherPromos?: boolean;
	autoApply?: boolean;
	displayOnWebsite?: boolean;
};

/**
 * Promotional code list response schema.
 */
export const PromotionalCodeListResponseSchema = z.object({
	data: z.array(PromotionalCodeListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type PromotionalCodeListResponse = z.infer<
	typeof PromotionalCodeListResponseSchema
>;

/**
 * Promotional code validation request schema.
 */
export const ValidatePromoCodeRequestSchema = z.object({
	promo_code: z.string().min(1).max(50),
	tenant_id: uuid,
	property_id: uuid.optional(),
	arrival_date: z.string(),
	departure_date: z.string(),
	room_type_id: uuid.optional(),
	rate_code: z.string().optional(),
	booking_amount: z.number().positive().optional(),
	guest_id: uuid.optional(),
	channel: z.string().optional(),
});

export type ValidatePromoCodeRequest = z.infer<
	typeof ValidatePromoCodeRequestSchema
>;

/**
 * Promotional code validation response schema.
 */
export const ValidatePromoCodeResponseSchema = z.object({
	valid: z.boolean(),
	promo_id: uuid.optional(),
	promo_code: z.string(),
	promo_name: z.string().optional(),
	discount_type: z.string().optional(),
	discount_value: z.string().optional(),
	estimated_savings: z.string().optional(),
	message: z.string().optional(),
	rejection_reason: z.string().optional(),
});

export type ValidatePromoCodeResponse = z.infer<
	typeof ValidatePromoCodeResponseSchema
>;

// =====================================================
// NIGHT AUDIT / BUSINESS DATES
// =====================================================

/**
 * Business date status enum matching database constraints.
 */
export const BusinessDateStatusEnum = z.enum(["OPEN", "CLOSED", "IN_AUDIT"]);
export type BusinessDateStatus = z.infer<typeof BusinessDateStatusEnum>;

/**
 * Night audit status enum matching database constraints.
 */
export const NightAuditStatusEnum = z.enum([
	"NOT_STARTED",
	"STARTED",
	"IN_PROGRESS",
	"COMPLETED",
	"FAILED",
	"CANCELLED",
]);
export type NightAuditStatus = z.infer<typeof NightAuditStatusEnum>;

/**
 * Night audit execution mode enum.
 */
export const NightAuditExecutionModeEnum = z.enum([
	"MANUAL",
	"SCHEDULED",
	"AUTOMATIC",
]);
export type NightAuditExecutionMode = z.infer<
	typeof NightAuditExecutionModeEnum
>;

/**
 * Current business date status API response schema.
 * Used by: GET /v1/night-audit/status
 */
export const BusinessDateStatusResponseSchema = z.object({
	business_date_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	business_date: z.string(), // ISO date
	system_date: z.string(), // ISO date
	date_status: BusinessDateStatusEnum,
	date_status_display: z.string(),
	night_audit_status: NightAuditStatusEnum.optional(),
	night_audit_status_display: z.string().optional(),
	night_audit_started_at: z.string().optional(),
	night_audit_completed_at: z.string().optional(),
	is_locked: z.boolean(),
	allow_postings: z.boolean(),
	allow_check_ins: z.boolean(),
	allow_check_outs: z.boolean(),
	arrivals_count: z.number().int().nonnegative().optional(),
	departures_count: z.number().int().nonnegative().optional(),
	stayovers_count: z.number().int().nonnegative().optional(),
	total_revenue: z.string().optional(), // Decimal as string
	audit_errors: z.number().int().nonnegative().optional(),
	audit_warnings: z.number().int().nonnegative().optional(),
	is_reconciled: z.boolean().optional(),
	notes: z.string().optional(),
});

export type BusinessDateStatusResponse = z.infer<
	typeof BusinessDateStatusResponseSchema
>;

/**
 * Night audit run summary for list views.
 * Used by: GET /v1/night-audit/history
 */
export const NightAuditRunListItemSchema = z.object({
	audit_run_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	business_date: z.string(),
	next_business_date: z.string().optional(),
	audit_status: z.string(),
	audit_status_display: z.string(),
	execution_mode: NightAuditExecutionModeEnum.optional(),
	execution_mode_display: z.string().optional(),
	is_test_run: z.boolean().optional(),
	started_at: z.string(),
	completed_at: z.string().optional(),
	duration_seconds: z.number().int().optional(),
	total_steps: z.number().int(),
	steps_completed: z.number().int(),
	steps_failed: z.number().int(),
	error_count: z.number().int().optional(),
	warning_count: z.number().int().optional(),
	is_successful: z.boolean().optional(),
	requires_attention: z.boolean().optional(),
	is_acknowledged: z.boolean().optional(),
	initiated_by: uuid,
	initiated_by_name: z.string().optional(),
	// Statistics
	occupancy_percent: z.string().optional(),
	adr: z.string().optional(),
	revpar: z.string().optional(),
	total_revenue: z.string().optional(),
	total_rooms_sold: z.number().int().optional(),
});

export type NightAuditRunListItem = z.infer<typeof NightAuditRunListItemSchema>;

/**
 * Night audit run list response schema.
 */
export const NightAuditRunListResponseSchema = z.object({
	data: z.array(NightAuditRunListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type NightAuditRunListResponse = z.infer<
	typeof NightAuditRunListResponseSchema
>;

/**
 * Night audit step detail for run details.
 */
export const NightAuditStepSchema = z.object({
	step_number: z.number().int(),
	step_name: z.string(),
	step_category: z.string().optional(),
	step_status: z.string(),
	step_status_display: z.string(),
	step_started_at: z.string().optional(),
	step_completed_at: z.string().optional(),
	step_duration_ms: z.number().int().optional(),
	records_processed: z.number().int().optional(),
	records_succeeded: z.number().int().optional(),
	records_failed: z.number().int().optional(),
	records_skipped: z.number().int().optional(),
	amount_posted: z.string().optional(),
	transactions_created: z.number().int().optional(),
	error_count: z.number().int().optional(),
	warning_count: z.number().int().optional(),
	error_message: z.string().optional(),
});

export type NightAuditStep = z.infer<typeof NightAuditStepSchema>;

/**
 * Night audit run detail response.
 * Used by: GET /v1/night-audit/runs/:runId
 */
export const NightAuditRunDetailResponseSchema =
	NightAuditRunListItemSchema.extend({
		steps: z.array(NightAuditStepSchema),
		reports_generated: z.array(z.string()).optional(),
		actions_taken: z.array(z.string()).optional(),
		notes: z.string().optional(),
		resolution_notes: z.string().optional(),
	});

export type NightAuditRunDetailResponse = z.infer<
	typeof NightAuditRunDetailResponseSchema
>;

// =====================================================
// BUSINESS CALENDAR
// =====================================================

/**
 * Business calendar entry — a single business date record with
 * open/close times and summary statistics.
 * Used by: GET /v1/night-audit/business-calendar
 */
export const BusinessCalendarEntrySchema = z.object({
	business_date_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	business_date: z.string(),
	system_date: z.string(),
	date_status: BusinessDateStatusEnum,
	date_status_display: z.string(),
	date_opened_at: z.string().optional(),
	date_closed_at: z.string().optional(),
	date_rolled_at: z.string().optional(),
	night_audit_status: z.string().optional(),
	night_audit_started_at: z.string().optional(),
	night_audit_completed_at: z.string().optional(),
	is_locked: z.boolean(),
	is_reconciled: z.boolean(),
	arrivals_count: z.number().int().nonnegative().optional(),
	departures_count: z.number().int().nonnegative().optional(),
	stayovers_count: z.number().int().nonnegative().optional(),
	total_revenue: z.string().optional(),
	total_payments: z.string().optional(),
	audit_errors: z.number().int().nonnegative().optional(),
	audit_warnings: z.number().int().nonnegative().optional(),
	notes: z.string().optional(),
});

export type BusinessCalendarEntry = z.infer<typeof BusinessCalendarEntrySchema>;

// =====================================================
// OTA / CHANNEL CONFIGURATION
// =====================================================

/**
 * OTA connection status enum.
 */
export const OtaConnectionStatusEnum = z.enum([
	"CONNECTED",
	"DISCONNECTED",
	"PENDING",
	"ERROR",
	"SUSPENDED",
]);
export type OtaConnectionStatus = z.infer<typeof OtaConnectionStatusEnum>;

/**
 * OTA sync status enum.
 */
export const OtaSyncStatusEnum = z.enum([
	"SYNCED",
	"PENDING",
	"SYNCING",
	"ERROR",
	"PARTIAL",
]);
export type OtaSyncStatus = z.infer<typeof OtaSyncStatusEnum>;

/**
 * OTA configuration list item schema.
 * Used by: GET /v1/ota-connections
 */
export const OtaConnectionListItemSchema = z.object({
	ota_connection_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	property_name: z.string().optional(),
	channel_code: z.string(),
	channel_name: z.string(),
	channel_type: z.string().optional(),
	connection_status: OtaConnectionStatusEnum,
	connection_status_display: z.string(),
	is_active: z.boolean(),
	is_two_way_sync: z.boolean(),
	last_sync_at: z.string().optional(),
	last_sync_status: OtaSyncStatusEnum.optional(),
	last_sync_status_display: z.string().optional(),
	last_error_message: z.string().optional(),
	sync_frequency_minutes: z.number().int().optional(),
	rooms_mapped: z.number().int().optional(),
	rates_mapped: z.number().int().optional(),
	pending_reservations: z.number().int().optional(),
	api_version: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type OtaConnectionListItem = z.infer<typeof OtaConnectionListItemSchema>;

/**
 * OTA connection list response schema.
 */
export const OtaConnectionListResponseSchema = z.object({
	data: z.array(OtaConnectionListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type OtaConnectionListResponse = z.infer<
	typeof OtaConnectionListResponseSchema
>;

/**
 * OTA sync log entry schema.
 * Used by: GET /v1/ota-connections/:connectionId/sync-history
 */
export const OtaSyncLogSchema = z.object({
	sync_log_id: uuid,
	ota_connection_id: uuid,
	sync_type: z.string(),
	sync_direction: z.enum(["INBOUND", "OUTBOUND", "BIDIRECTIONAL"]),
	sync_status: OtaSyncStatusEnum,
	sync_status_display: z.string(),
	started_at: z.string(),
	completed_at: z.string().optional(),
	duration_ms: z.number().int().optional(),
	records_processed: z.number().int().optional(),
	records_created: z.number().int().optional(),
	records_updated: z.number().int().optional(),
	records_failed: z.number().int().optional(),
	error_message: z.string().optional(),
	triggered_by: z.enum(["SCHEDULED", "MANUAL", "WEBHOOK"]).optional(),
});

export type OtaSyncLog = z.infer<typeof OtaSyncLogSchema>;

/**
 * OTA sync log list response schema.
 */
export const OtaSyncLogListResponseSchema = z.object({
	data: z.array(OtaSyncLogSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type OtaSyncLogListResponse = z.infer<
	typeof OtaSyncLogListResponseSchema
>;

// =====================================================
// CASHIER SESSIONS
// =====================================================

/**
 * Cashier session status enum.
 */
export const CashierSessionStatusEnum = z.enum([
	"OPEN",
	"CLOSED",
	"SUSPENDED",
	"RECONCILED",
	"PENDING_APPROVAL",
]);
export type CashierSessionStatus = z.infer<typeof CashierSessionStatusEnum>;

/**
 * Cashier session list item schema.
 * Used by: GET /v1/cashier-sessions
 */
export const CashierSessionListItemSchema = z.object({
	session_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	session_number: z.string(),
	session_name: z.string().optional(),
	cashier_id: uuid,
	cashier_name: z.string().optional(),
	terminal_id: z.string().optional(),
	terminal_name: z.string().optional(),
	location: z.string().optional(),
	session_status: z.string(),
	session_status_display: z.string(),
	opened_at: z.string(),
	closed_at: z.string().optional(),
	business_date: z.string(),
	shift_type: z.string().optional(),
	opening_float_declared: z.string(),
	/** Property base currency the drawer is counted in (ISO 4217). */
	base_currency: z.string().optional(),
	total_transactions: z.number().int().optional(),
	total_revenue: z.string().optional(),
	total_refunds: z.string().optional(),
	net_revenue: z.string().optional(),
	expected_cash_balance: z.string().optional(),
	closing_cash_counted: z.string().optional(),
	cash_variance: z.string().optional(),
	has_variance: z.boolean().optional(),
	reconciled: z.boolean().optional(),
	approved: z.boolean().optional(),
	created_at: z.string().optional(),
});

export type CashierSessionListItem = z.infer<
	typeof CashierSessionListItemSchema
>;

/** Cashier session list response schema. */
export const CashierSessionListResponseSchema = z.object({
	data: z.array(CashierSessionListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type CashierSessionListResponse = z.infer<
	typeof CashierSessionListResponseSchema
>;

// =====================================================
// SHIFT HANDOVERS
// =====================================================

/**
 * Shift handover list item schema.
 * Used by: GET /v1/shift-handovers
 */
export const ShiftHandoverListItemSchema = z.object({
	handover_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	handover_number: z.string().optional(),
	handover_title: z.string().optional(),
	shift_date: z.string(),
	outgoing_shift: z.string(),
	outgoing_user_id: uuid,
	outgoing_user_name: z.string().optional(),
	incoming_shift: z.string(),
	incoming_user_id: uuid,
	incoming_user_name: z.string().optional(),
	department: z.string(),
	department_display: z.string(),
	handover_status: z.string(),
	handover_status_display: z.string(),
	handover_started_at: z.string().optional(),
	handover_completed_at: z.string().optional(),
	current_occupancy_percent: z.string().optional(),
	expected_arrivals_count: z.number().int().optional(),
	expected_departures_count: z.number().int().optional(),
	tasks_pending: z.number().int().optional(),
	tasks_urgent: z.number().int().optional(),
	key_points: z.string(),
	requires_follow_up: z.boolean().optional(),
	acknowledged: z.boolean().optional(),
	created_at: z.string().optional(),
});

export type ShiftHandoverListItem = z.infer<typeof ShiftHandoverListItemSchema>;

/** Shifts and departments, matching the table's CHECK constraints (lowercase). */
export const ShiftNameEnum = z.enum(["morning", "afternoon", "evening", "night"]);

export type ShiftName = z.infer<typeof ShiftNameEnum>;

export const ShiftHandoverDepartmentEnum = z.enum([
	"front_desk",
	"housekeeping",
	"maintenance",
	"food_beverage",
	"management",
	"sales",
	"security",
	"spa",
	"concierge",
	"other",
]);

export type ShiftHandoverDepartment = z.infer<typeof ShiftHandoverDepartmentEnum>;

/**
 * Matches the table's CHECK constraint. The previous definition here was
 * UPPERCASE with two values the constraint rejects ('DRAFT', 'REVIEWED') and
 * missing two it accepts — the same drift found in `CompanyTypeEnum` and
 * `LostFoundStatusEnum`. Nothing consumed it, so it was replaced rather than
 * kept alongside.
 */
export const ShiftHandoverStatusEnum = z.enum([
	"pending",
	"in_progress",
	"completed",
	"acknowledged",
	"escalated",
]);

export type ShiftHandoverStatus = z.infer<typeof ShiftHandoverStatusEnum>;

/**
 * Open a handover for a shift. `handover_number` is absent on purpose: it is
 * UNIQUE and generated server-side.
 *
 * `incoming_user_id` is required because the column is NOT NULL — a handover
 * addressed to nobody has no one to acknowledge it, which is the whole point of
 * the record. See ui-gaps/08-shift-handovers.md.
 */
export const ShiftHandoverWriteBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	department: ShiftHandoverDepartmentEnum,
	outgoing_shift: ShiftNameEnum,
	outgoing_user_id: uuid,
	outgoing_user_name: z.string().max(200).optional(),
	incoming_shift: ShiftNameEnum,
	incoming_user_id: uuid,
	incoming_user_name: z.string().max(200).optional(),
	handover_title: z.string().max(255).optional(),
	key_points: z.string().min(1),
	important_notes: z.string().optional(),
	urgent_matters: z.string().optional(),
	requires_follow_up: z.boolean().optional(),
	cash_on_hand: z.coerce.number().optional(),
	deposits_to_make: z.coerce.number().optional(),
	payment_issues: z.string().optional(),
	staff_issues: z.string().optional(),
	special_situations: z.string().optional(),
});

export type ShiftHandoverWriteBody = z.infer<typeof ShiftHandoverWriteBodySchema>;

/**
 * Edit an open handover while the shift runs. Everything is optional so a screen
 * can send only what changed; the shift, department and the two users are fixed
 * at creation because changing who a handover is between makes it a different
 * record.
 */
export const ShiftHandoverUpdateBodySchema = z.object({
	tenant_id: uuid,
	handover_title: z.string().max(255).optional(),
	key_points: z.string().min(1).optional(),
	important_notes: z.string().optional(),
	urgent_matters: z.string().optional(),
	handover_status: ShiftHandoverStatusEnum.optional(),
	requires_follow_up: z.boolean().optional(),
	cash_on_hand: z.coerce.number().optional(),
	deposits_to_make: z.coerce.number().optional(),
	payment_issues: z.string().optional(),
	staff_issues: z.string().optional(),
	special_situations: z.string().optional(),
});

export type ShiftHandoverUpdateBody = z.infer<typeof ShiftHandoverUpdateBodySchema>;

/**
 * The incoming staff member signs off, capturing who and when. A handover list
 * nobody is prompted to read is not worth building — this is the transition that
 * makes it a handover rather than a note.
 */
export const ShiftHandoverAcknowledgeBodySchema = z.object({
	tenant_id: uuid,
	acknowledgment_notes: z.string().max(2000).optional(),
	questions_asked: z.string().max(2000).optional(),
	handover_quality_rating: z.coerce.number().int().min(1).max(5).optional(),
});

export type ShiftHandoverAcknowledgeBody = z.infer<typeof ShiftHandoverAcknowledgeBodySchema>;

/**
 * Service-layer input for a shift handover write. Camel-cased counterpart of
 * {@link ShiftHandoverWriteBodySchema}; lives here because AGENTS.md requires
 * service-layer shapes in the schema package, not in a service file.
 */
export type ShiftHandoverWriteInput = {
	propertyId: string;
	shiftDate: string;
	department: string;
	outgoingShift: string;
	outgoingUserId: string;
	incomingShift: string;
	incomingUserId: string;
	keyPoints: string;
	outgoingUserName?: string;
	incomingUserName?: string;
	handoverTitle?: string;
	importantNotes?: string;
	urgentMatters?: string;
	handoverStatus?: string;
	requiresFollowUp?: boolean;
	cashOnHand?: number;
	depositsToMake?: number;
	paymentIssues?: string;
	staffIssues?: string;
	specialSituations?: string;
};

// =====================================================
// BANQUET EVENT ORDERS
// =====================================================

/**
 * BEO status enum.
 */
export const BeoStatusEnum = z.enum([
	"DRAFT",
	"PENDING",
	"CONFIRMED",
	"IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
]);
export type BeoStatus = z.infer<typeof BeoStatusEnum>;

/**
 * Banquet Event Order list item schema.
 * Used by: GET /v1/banquet-orders
 */
export const BanquetOrderListItemSchema = z.object({
	beo_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	event_booking_id: uuid,
	beo_number: z.string(),
	beo_version: z.number().int().optional(),
	beo_status: z.string(),
	beo_status_display: z.string(),
	event_date: z.string(),
	event_start_time: z.string(),
	event_end_time: z.string(),
	meeting_room_id: uuid,
	meeting_room_name: z.string().optional(),
	room_setup: z.string(),
	room_setup_display: z.string(),
	guaranteed_count: z.number().int(),
	expected_count: z.number().int().optional(),
	actual_count: z.number().int().optional(),
	menu_type: z.string().optional(),
	service_style: z.string().optional(),
	bar_type: z.string().optional(),
	food_subtotal: z.string().optional(),
	beverage_subtotal: z.string().optional(),
	total_estimated: z.string().optional(),
	total_actual: z.string().optional(),
	client_approved: z.boolean().optional(),
	chef_approved: z.boolean().optional(),
	manager_approved: z.boolean().optional(),
	setup_completed: z.boolean().optional(),
	event_started: z.boolean().optional(),
	event_ended: z.boolean().optional(),
	created_at: z.string(),
});

export type BanquetOrderListItem = z.infer<typeof BanquetOrderListItemSchema>;

// =====================================================
// GUEST FEEDBACK
// =====================================================

/**
 * Guest feedback list item schema.
 * Used by: GET /v1/guest-feedback
 */
export const GuestFeedbackListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	// Nullable in the table since 2026-08-13: staff-entered feedback may predate a
	// guest record, and is not always attributable to one stay.
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	reservation_id: uuid.optional(),
	feedback_source: z.string().optional(),
	feedback_source_display: z.string().optional(),
	overall_rating: z.string().optional(),
	rating_scale: z.number().int().optional(),
	cleanliness_rating: z.string().optional(),
	staff_rating: z.string().optional(),
	location_rating: z.string().optional(),
	value_rating: z.string().optional(),
	review_title: z.string().optional(),
	review_text: z.string().optional(),
	would_recommend: z.boolean().optional(),
	would_return: z.boolean().optional(),
	sentiment_label: z.string().optional(),
	is_verified: z.boolean().optional(),
	is_public: z.boolean().optional(),
	is_featured: z.boolean().optional(),
	response_text: z.string().optional(),
	responded_at: z.string().optional(),
	created_at: z.string().optional(),

	// Complaint-handling workflow. Feedback with no owner and no status is a table
	// that fills up and is never worked. See ui-gaps/09-guest-feedback.md.
	feedback_status: z.string().optional(),
	feedback_status_display: z.string().optional(),
	feedback_category: z.string().optional(),
	assigned_to: uuid.optional(),
	assigned_at: z.string().optional(),
	resolution_notes: z.string().optional(),
	resolved_at: z.string().optional(),
	service_recovery_reference: z.string().optional(),
});

export type GuestFeedbackListItem = z.infer<typeof GuestFeedbackListItemSchema>;

/** Where a piece of feedback came from. */
export const GuestFeedbackSourceEnum = z.enum([
	"GUEST_PORTAL",
	"STAFF_ENTERED",
	"EMAIL_SURVEY",
	"SMS_SURVEY",
	"IN_APP",
	"OTA_REVIEW",
	"EMAIL",
	"PHONE",
	"GOOGLE",
	"TRIPADVISOR",
	"BOOKING_COM",
]);

export type GuestFeedbackSource = z.infer<typeof GuestFeedbackSourceEnum>;

/** Complaint-handling state, matching the table's CHECK constraint (lowercase). */
export const GuestFeedbackStatusEnum = z.enum([
	"new",
	"acknowledged",
	"in_progress",
	"responded",
	"resolved",
	"closed",
]);

export type GuestFeedbackStatus = z.infer<typeof GuestFeedbackStatusEnum>;

/**
 * Log a piece of feedback.
 *
 * `guest_id` and `reservation_id` are optional: the point of `STAFF_ENTERED` is a
 * phone complaint from someone who may not be in the system yet, and the table's
 * NOT NULL on both is what made that impossible. See ui-gaps/09-guest-feedback.md.
 */
export const GuestFeedbackWriteBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	feedback_source: GuestFeedbackSourceEnum,
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	review_title: z.string().max(500).optional(),
	review_text: z.string().min(1),
	overall_rating: z.coerce.number().nonnegative().optional(),
	rating_scale: z.coerce.number().int().positive().max(10).optional(),
	cleanliness_rating: z.coerce.number().nonnegative().optional(),
	staff_rating: z.coerce.number().nonnegative().optional(),
	location_rating: z.coerce.number().nonnegative().optional(),
	value_rating: z.coerce.number().nonnegative().optional(),
	would_recommend: z.boolean().optional(),
	would_return: z.boolean().optional(),
	feedback_category: z.string().max(100).optional(),
	sentiment_label: z.string().max(20).optional(),
	is_public: z.boolean().optional(),
	language_code: z.string().max(10).optional(),
});

export type GuestFeedbackWriteBody = z.infer<typeof GuestFeedbackWriteBodySchema>;

/**
 * Guest-portal feedback intake.
 *
 * The portal is unauthenticated guest context, so it must not call
 * `/v1/guest-feedback` directly with a caller-supplied `guest_id` — anyone could
 * then attribute feedback to any guest. The confirmation code is the credential:
 * the server resolves it to the reservation and derives guest, property and stay
 * from that. Same pattern as self-service check-in and checkout.
 * See ui-gaps/09-guest-feedback.md and ui-gaps/11-self-service-coverage.md.
 */
export const SelfServiceFeedbackBodySchema = z.object({
	tenant_id: uuid,
	confirmation_code: z.string().min(4).max(50),
	review_text: z.string().min(1).max(5000),
	review_title: z.string().max(500).optional(),
	overall_rating: z.coerce.number().min(0).max(10).optional(),
	cleanliness_rating: z.coerce.number().min(0).max(10).optional(),
	staff_rating: z.coerce.number().min(0).max(10).optional(),
	location_rating: z.coerce.number().min(0).max(10).optional(),
	value_rating: z.coerce.number().min(0).max(10).optional(),
	would_recommend: z.boolean().optional(),
	would_return: z.boolean().optional(),
});

export type SelfServiceFeedbackBody = z.infer<typeof SelfServiceFeedbackBodySchema>;

/** Triage: categorise, set sentiment, assign an owner, adjust publication. */
export const GuestFeedbackUpdateBodySchema = z.object({
	tenant_id: uuid,
	feedback_category: z.string().max(100).optional(),
	sentiment_label: z.string().max(20).optional(),
	feedback_status: GuestFeedbackStatusEnum.optional(),
	assigned_to: uuid.optional(),
	is_public: z.boolean().optional(),
	is_featured: z.boolean().optional(),
	is_verified: z.boolean().optional(),
});

export type GuestFeedbackUpdateBody = z.infer<typeof GuestFeedbackUpdateBodySchema>;

/** Record the response sent to the guest. Stamps responded_by/responded_at. */
export const GuestFeedbackRespondBodySchema = z.object({
	tenant_id: uuid,
	response_text: z.string().min(1).max(5000),
	is_public: z.boolean().optional(),
});

export type GuestFeedbackRespondBody = z.infer<typeof GuestFeedbackRespondBodySchema>;

/**
 * Close the loop. `service_recovery_reference` carries the comp posting or
 * gesture, so a goodwill spend is recorded against the complaint that caused it
 * rather than floating free on the folio.
 */
export const GuestFeedbackResolveBodySchema = z.object({
	tenant_id: uuid,
	resolution_notes: z.string().min(1).max(5000),
	service_recovery_reference: z.string().max(200).optional(),
	feedback_status: z.enum(["resolved", "closed"]).optional(),
});

export type GuestFeedbackResolveBody = z.infer<typeof GuestFeedbackResolveBodySchema>;

// =====================================================
// POLICE REPORTS
// =====================================================

/**
 * Police report status enum.
 */
export const PoliceReportStatusEnum = z.enum([
	"DRAFT",
	"FILED",
	"UNDER_INVESTIGATION",
	"RESOLVED",
	"CLOSED",
	"ARCHIVED",
]);
export type PoliceReportStatus = z.infer<typeof PoliceReportStatusEnum>;

/**
 * Police report list item schema.
 * Used by: GET /v1/police-reports
 */
export const PoliceReportListItemSchema = z.object({
	report_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	report_number: z.string(),
	police_case_number: z.string().optional(),
	incident_id: uuid.optional(),
	incident_date: z.string(),
	incident_time: z.string().optional(),
	reported_date: z.string(),
	incident_type: z.string().optional(),
	incident_type_display: z.string().optional(),
	incident_description: z.string(),
	incident_location: z.string().optional(),
	room_number: z.string().optional(),
	agency_name: z.string(),
	responding_officer_name: z.string().optional(),
	report_status: z.string(),
	report_status_display: z.string(),
	suspect_count: z.number().int().optional(),
	victim_count: z.number().int().optional(),
	guest_involved: z.boolean().optional(),
	staff_involved: z.boolean().optional(),
	property_stolen: z.boolean().optional(),
	total_loss_value: z.string().optional(),
	arrests_made: z.boolean().optional(),
	investigation_ongoing: z.boolean().optional(),
	resolved: z.boolean().optional(),
	confidential: z.boolean().optional(),
	created_at: z.string().optional(),
});

export type PoliceReportListItem = z.infer<typeof PoliceReportListItemSchema>;

// =====================================================
// BUSINESS DATE UPSERT
// =====================================================

/**
 * Request body for upserting a business date for a property.
 * Used by: PUT /v1/night-audit/business-date
 */
export const UpsertBusinessDateBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	business_date: z.string(), // YYYY-MM-DD
	date_status: BusinessDateStatusEnum.default("OPEN"),
	night_audit_status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]).default("PENDING"),
});

export type UpsertBusinessDateBody = z.infer<typeof UpsertBusinessDateBodySchema>;

// -----------------------------------------------------------------------------
// Company write contracts
//
// Values are lowercase because that is what the `companies` CHECK constraints
// allow and what the reads return. `CompanyTypeEnum` in shared/enums.ts is
// UPPERCASE and cannot be used against this table — a mismatch worth resolving,
// but not by silently diverging here.
// -----------------------------------------------------------------------------

export const CompanyTypeWriteEnum = z.enum([
	"corporate",
	"travel_agency",
	"wholesaler",
	"ota",
	"event_planner",
	"airline",
	"government",
	"educational",
	"consortium",
	"partner",
]);

export const CompanyPaymentTermsEnum = z.enum([
	"due_on_receipt",
	"net_15",
	"net_30",
	"net_45",
	"net_60",
	"net_90",
	"custom",
]);

export const CompanyCreditStatusWriteEnum = z.enum([
	"pending",
	"active",
	"suspended",
	"blocked",
	"under_review",
	"expired",
	"revoked",
	"cancelled",
]);

export const CompanyCommissionTypeEnum = z.enum([
	"percentage",
	"flat_rate",
	"tiered",
	"net_rate",
	"none",
]);

/**
 * Create a company. The write surface is deliberately the contract-and-contact
 * information a person types — `company_id`, `current_balance` and the booking
 * statistics on that table are generated or machine-maintained.
 */
export const CompanyWriteBodySchema = z.object({
	tenant_id: uuid,
	company_name: z.string().min(1).max(255),
	company_type: CompanyTypeWriteEnum,
	legal_name: z.string().max(255).optional(),
	company_code: z.string().max(50).optional(),
	primary_contact_name: z.string().max(255).optional(),
	primary_contact_email: z.string().email().max(255).optional(),
	primary_contact_phone: z.string().max(50).optional(),
	billing_contact_name: z.string().max(255).optional(),
	billing_contact_email: z.string().email().max(255).optional(),
	address_line1: z.string().max(255).optional(),
	city: z.string().max(100).optional(),
	state_province: z.string().max(100).optional(),
	postal_code: z.string().max(20).optional(),
	country: z.string().max(100).optional(),
	credit_limit: z.coerce.number().nonnegative().optional(),
	payment_terms_type: CompanyPaymentTermsEnum.optional(),
	credit_status: CompanyCreditStatusWriteEnum.optional(),
	commission_rate: z.coerce.number().min(0).max(100).optional(),
	commission_type: CompanyCommissionTypeEnum.optional(),
	is_active: z.boolean().optional(),
});

export type CompanyWriteBody = z.infer<typeof CompanyWriteBodySchema>;

/** Update a company. Absent fields keep their stored value. */
export const CompanyUpdateBodySchema = CompanyWriteBodySchema.partial().extend({
	tenant_id: uuid,
});

export type CompanyUpdateBody = z.infer<typeof CompanyUpdateBodySchema>;

// -----------------------------------------------------------------------------
// Police report write contracts
// -----------------------------------------------------------------------------

export const PoliceIncidentTypeEnum = z.enum([
	"theft",
	"assault",
	"vandalism",
	"trespassing",
	"fraud",
	"suspicious_activity",
	"missing_person",
	"death",
	"drug_related",
	"domestic_disturbance",
	"noise_complaint",
	"vehicle_incident",
	"other",
]);

/**
 * Status values the `police_reports` CHECK constraint actually allows.
 *
 * Distinct from {@link PoliceReportStatusEnum} above, which is UPPERCASE
 * (`FILED`, `RESOLVED`, `ARCHIVED`) and does not match the table — writing any of
 * those would be rejected by Postgres. The two want reconciling; until then the
 * write path must use this one.
 */
export const PoliceReportStatusWriteEnum = z.enum([
	"filed",
	"under_investigation",
	"closed",
	"charges_filed",
	"no_action",
	"referred",
	"pending",
]);

/**
 * File a police report. `report_number` is absent on purpose: it is UNIQUE NOT
 * NULL and generated server-side, because a caller-supplied number is how two
 * reports end up fighting over one identifier.
 */
export const PoliceReportWriteBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	incident_id: uuid.optional(),
	incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	incident_time: z.string().min(4).max(8).optional(),
	reported_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	incident_type: PoliceIncidentTypeEnum.optional(),
	incident_description: z.string().min(1).max(5000),
	incident_location: z.string().max(255).optional(),
	room_number: z.string().max(50).optional(),
	agency_name: z.string().min(1).max(255),
	agency_jurisdiction: z.string().max(255).optional(),
	agency_contact_number: z.string().max(50).optional(),
	responding_officer_name: z.string().max(255).optional(),
	responding_officer_badge: z.string().max(100).optional(),
	guest_involved: z.boolean().optional(),
	staff_involved: z.boolean().optional(),
	property_stolen: z.boolean().optional(),
	total_loss_value: z.coerce.number().nonnegative().optional(),
	injuries_reported: z.boolean().optional(),
});

export type PoliceReportWriteBody = z.infer<typeof PoliceReportWriteBodySchema>;

export const PoliceReportUpdateBodySchema = PoliceReportWriteBodySchema.partial().extend({
	tenant_id: uuid,
});

export type PoliceReportUpdateBody = z.infer<typeof PoliceReportUpdateBodySchema>;

/**
 * Move a report through its status. The police case number is captured with the
 * transition rather than as a later edit — it is what makes the report traceable
 * back to the force's own record.
 */
export const PoliceReportStatusBodySchema = z.object({
	tenant_id: uuid,
	report_status: PoliceReportStatusWriteEnum,
	police_case_number: z.string().max(100).optional(),
	lead_investigator_name: z.string().max(255).optional(),
	follow_up_required: z.boolean().optional(),
	follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type PoliceReportStatusBody = z.infer<typeof PoliceReportStatusBodySchema>;

/**
 * Service-layer input for a company write. Camel-cased counterpart of
 * {@link CompanyWriteBodySchema}; lives here because AGENTS.md requires
 * service-layer shapes in the schema package, not in a service file.
 */
export type CompanyWriteInput = {
	companyName: string;
	companyType: CompanyWriteBody["company_type"];
	legalName?: string;
	companyCode?: string;
	primaryContactName?: string;
	primaryContactEmail?: string;
	primaryContactPhone?: string;
	billingContactName?: string;
	billingContactEmail?: string;
	addressLine1?: string;
	city?: string;
	stateProvince?: string;
	postalCode?: string;
	country?: string;
	creditLimit?: number;
	paymentTermsType?: CompanyWriteBody["payment_terms_type"];
	creditStatus?: CompanyWriteBody["credit_status"];
	commissionRate?: number;
	commissionType?: CompanyWriteBody["commission_type"];
	isActive?: boolean;
};

/**
 * Service-layer input for filing or correcting a police report. `reportNumber` is
 * absent deliberately — it is generated server-side.
 */
export type PoliceReportWriteInput = {
	propertyId: string;
	incidentId?: string;
	incidentDate: string;
	incidentTime?: string;
	reportedDate?: string;
	incidentType?: PoliceReportWriteBody["incident_type"];
	incidentDescription: string;
	incidentLocation?: string;
	roomNumber?: string;
	agencyName: string;
	agencyJurisdiction?: string;
	agencyContactNumber?: string;
	respondingOfficerName?: string;
	respondingOfficerBadge?: string;
	guestInvolved?: boolean;
	staffInvolved?: boolean;
	propertyStolen?: boolean;
	totalLossValue?: number;
	injuriesReported?: boolean;
};

/** Service-layer input for a police report status transition. */
export type PoliceReportStatusInput = {
	reportStatus: PoliceReportStatusBody["report_status"];
	policeCaseNumber?: string;
	leadInvestigatorName?: string;
	followUpRequired?: boolean;
	followUpDate?: string;
};
