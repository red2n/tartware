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

export type MeetingRoomListResponse = z.infer<typeof MeetingRoomListResponseSchema>;

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

export type EventBookingListResponse = z.infer<typeof EventBookingListResponseSchema>;

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

export type WaitlistEntryListResponse = z.infer<typeof WaitlistEntryListResponseSchema>;
