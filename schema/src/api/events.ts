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

// =====================================================
// GROUP BOOKINGS
// =====================================================

/**
 * Group booking status enum matching database constraints.
 */
export const GroupBookingStatusEnum = z.enum([
	"TENTATIVE",
	"CONFIRMED",
	"DEFINITE",
	"CANCELED",
	"COMPLETED",
	"WAITLISTED",
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
 * Group booking list response schema.
 */
export const GroupBookingListResponseSchema = z.object({
	data: z.array(GroupBookingListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type GroupBookingListResponse = z.infer<typeof GroupBookingListResponseSchema>;

// =====================================================
// PROMOTIONAL CODES
// =====================================================

/**
 * Promotional code status enum matching database constraints.
 */
export const PromotionalCodeStatusEnum = z.enum([
	"ACTIVE",
	"INACTIVE",
	"EXPIRED",
	"DEPLETED",
	"SCHEDULED",
	"SUSPENDED",
]);
export type PromotionalCodeStatus = z.infer<typeof PromotionalCodeStatusEnum>;

/**
 * Promotional code discount type enum.
 */
export const PromotionalCodeDiscountTypeEnum = z.enum([
	"PERCENTAGE",
	"FIXED_AMOUNT",
	"FREE_NIGHTS",
	"UPGRADE",
	"AMENITY",
]);
export type PromotionalCodeDiscountType = z.infer<typeof PromotionalCodeDiscountTypeEnum>;

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

export type PromotionalCodeListItem = z.infer<typeof PromotionalCodeListItemSchema>;

/**
 * Promotional code list response schema.
 */
export const PromotionalCodeListResponseSchema = z.object({
	data: z.array(PromotionalCodeListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type PromotionalCodeListResponse = z.infer<typeof PromotionalCodeListResponseSchema>;

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

export type ValidatePromoCodeRequest = z.infer<typeof ValidatePromoCodeRequestSchema>;

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

export type ValidatePromoCodeResponse = z.infer<typeof ValidatePromoCodeResponseSchema>;

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
export const NightAuditExecutionModeEnum = z.enum(["MANUAL", "SCHEDULED", "AUTOMATIC"]);
export type NightAuditExecutionMode = z.infer<typeof NightAuditExecutionModeEnum>;

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

export type BusinessDateStatusResponse = z.infer<typeof BusinessDateStatusResponseSchema>;

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

export type NightAuditRunListResponse = z.infer<typeof NightAuditRunListResponseSchema>;

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
export const NightAuditRunDetailResponseSchema = NightAuditRunListItemSchema.extend({
	steps: z.array(NightAuditStepSchema),
	reports_generated: z.array(z.string()).optional(),
	actions_taken: z.array(z.string()).optional(),
	notes: z.string().optional(),
	resolution_notes: z.string().optional(),
});

export type NightAuditRunDetailResponse = z.infer<typeof NightAuditRunDetailResponseSchema>;

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

export type OtaConnectionListResponse = z.infer<typeof OtaConnectionListResponseSchema>;

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

export type OtaSyncLogListResponse = z.infer<typeof OtaSyncLogListResponseSchema>;
