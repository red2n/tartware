/**
 * DEV DOC
 * Module: api/reservations.ts
 * Purpose: Reservation API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";
// =====================================================
// ALLOTMENTS (Room Blocks)
// =====================================================

/**
 * Allotment type enum matching database constraints.
 */
export const AllotmentTypeEnum = z.enum([
	"GROUP",
	"CONTRACT",
	"EVENT",
	"TOUR",
	"CORPORATE",
	"WEDDING",
	"CONFERENCE",
]);
export type AllotmentType = z.infer<typeof AllotmentTypeEnum>;

/**
 * Allotment status enum matching database constraints.
 */
export const AllotmentStatusEnum = z.enum([
	"TENTATIVE",
	"DEFINITE",
	"ACTIVE",
	"PICKUP_IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
]);
export type AllotmentStatus = z.infer<typeof AllotmentStatusEnum>;

/**
 * Allotment list item schema for API responses.
 */
export const AllotmentListItemSchema = z.object({
	allotment_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	allotment_code: z.string(),
	allotment_name: z.string(),
	allotment_type: z.string(),
	allotment_type_display: z.string(),
	allotment_status: z.string(),
	allotment_status_display: z.string(),

	// Date Range
	start_date: z.string(),
	end_date: z.string(),
	cutoff_date: z.string().nullable(),

	// Room Allocation
	room_type_id: uuid.optional(),
	total_rooms_blocked: z.number().int(),
	total_room_nights: z.number().int().nullable(),
	rooms_per_night: z.number().int().nullable(),

	// Pickup Tracking
	rooms_picked_up: z.number().int(),
	rooms_available: z.number().int().nullable(),
	pickup_percentage: z.number(),

	// Financial
	rate_type: z.string().nullable(),
	contracted_rate: z.number().nullable(),
	total_expected_revenue: z.number().nullable(),
	actual_revenue: z.number().nullable(),
	currency_code: z.string(),

	// Account Information
	account_name: z.string().nullable(),
	account_type: z.string().nullable(),
	billing_type: z.string(),

	// Contact
	contact_name: z.string().nullable(),
	contact_email: z.string().nullable(),

	// Terms
	deposit_required: z.boolean(),
	attrition_clause: z.boolean(),
	attrition_percentage: z.number().nullable(),
	guaranteed_rooms: z.number().int().nullable(),

	// Flags
	is_vip: z.boolean(),
	priority_level: z.number().int(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type AllotmentListItem = z.infer<typeof AllotmentListItemSchema>;

/**
 * Allotment list response schema.
 */
export const AllotmentListResponseSchema = z.object({
	data: z.array(AllotmentListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type AllotmentListResponse = z.infer<typeof AllotmentListResponseSchema>;

// =====================================================
// BOOKING SOURCES
// =====================================================

/**
 * Booking source type enum matching database constraints.
 */
export const BookingSourceTypeEnum = z.enum([
	"OTA",
	"GDS",
	"DIRECT",
	"METASEARCH",
	"WHOLESALER",
	"AGENT",
	"CORPORATE",
	"WALK_IN",
	"PHONE",
	"EMAIL",
	"OTHER",
]);
export type BookingSourceType = z.infer<typeof BookingSourceTypeEnum>;

/**
 * Booking source list item schema for API responses.
 */
export const BookingSourceListItemSchema = z.object({
	source_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	property_name: z.string().optional(),
	source_code: z.string(),
	source_name: z.string(),
	source_type: z.string(),
	source_type_display: z.string(),
	category: z.string().nullable(),

	// Status
	is_active: z.boolean(),
	is_bookable: z.boolean(),

	// Channel Details
	channel_name: z.string().nullable(),
	channel_website: z.string().nullable(),

	// Commission
	commission_type: z.string(),
	commission_percentage: z.number().nullable(),
	commission_fixed_amount: z.number().nullable(),

	// Performance Metrics
	total_bookings: z.number().int(),
	total_revenue: z.number().nullable(),
	total_room_nights: z.number().int(),
	average_booking_value: z.number().nullable(),
	conversion_rate: z.number().nullable(),
	cancellation_rate: z.number().nullable(),

	// Rankings
	ranking: z.number().int().nullable(),
	is_preferred: z.boolean(),
	is_featured: z.boolean(),

	// Integration
	has_integration: z.boolean(),
	integration_type: z.string().nullable(),
	last_sync_at: z.string().optional(),

	// Display
	display_name: z.string().nullable(),
	logo_url: z.string().nullable(),
	color_code: z.string().nullable(),
});

export type BookingSourceListItem = z.infer<typeof BookingSourceListItemSchema>;

/**
 * Booking source list response schema.
 */
export const BookingSourceListResponseSchema = z.object({
	data: z.array(BookingSourceListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type BookingSourceListResponse = z.infer<typeof BookingSourceListResponseSchema>;

// =====================================================
// MARKET SEGMENTS
// =====================================================

/**
 * Market segment type enum matching database constraints.
 */
export const MarketSegmentTypeEnum = z.enum([
	"CORPORATE",
	"LEISURE",
	"GROUP",
	"GOVERNMENT",
	"WHOLESALE",
	"NEGOTIATED",
	"PACKAGE",
	"QUALIFIED",
	"OTHER",
]);
export type MarketSegmentType = z.infer<typeof MarketSegmentTypeEnum>;

/**
 * Market segment list item schema for API responses.
 */
export const MarketSegmentListItemSchema = z.object({
	segment_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	property_name: z.string().optional(),
	segment_code: z.string(),
	segment_name: z.string(),
	segment_type: z.string(),
	segment_type_display: z.string(),

	// Status
	is_active: z.boolean(),
	is_bookable: z.boolean(),

	// Hierarchy
	parent_segment_id: uuid.optional(),
	segment_level: z.number().int(),

	// Financial Characteristics
	average_daily_rate: z.number().nullable(),
	average_length_of_stay: z.number().nullable(),
	average_booking_value: z.number().nullable(),
	contribution_to_revenue: z.number().nullable(),

	// Behavior Metrics
	booking_lead_time_days: z.number().int().nullable(),
	cancellation_rate: z.number().nullable(),
	no_show_rate: z.number().nullable(),
	repeat_guest_rate: z.number().nullable(),

	// Volume Tracking
	total_bookings: z.number().int(),
	total_room_nights: z.number().int(),
	total_revenue: z.number().nullable(),

	// Rate Strategy
	rate_multiplier: z.number(),
	discount_percentage: z.number().nullable(),
	premium_percentage: z.number().nullable(),

	// Commission
	pays_commission: z.boolean(),
	commission_percentage: z.number().nullable(),

	// Marketing
	marketing_priority: z.number().int(),
	is_target_segment: z.boolean(),
	lifetime_value: z.number().nullable(),

	// Loyalty
	loyalty_program_eligible: z.boolean(),
	loyalty_points_multiplier: z.number(),

	// Display
	ranking: z.number().int().nullable(),
	color_code: z.string().nullable(),
	description: z.string().nullable(),

	// Audit
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
});

export type MarketSegmentListItem = z.infer<typeof MarketSegmentListItemSchema>;

/**
 * Market segment list response schema.
 */
export const MarketSegmentListResponseSchema = z.object({
	data: z.array(MarketSegmentListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type MarketSegmentListResponse = z.infer<typeof MarketSegmentListResponseSchema>;

// =====================================================
// CHANNEL MAPPINGS
// =====================================================

/**
 * Channel mapping list item schema for API responses.
 */
export const ChannelMappingListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),

	// Channel Information
	channel_name: z.string(),
	channel_code: z.string(),

	// Entity Mapping
	entity_type: z.string(),
	entity_id: uuid,
	external_id: z.string(),
	external_code: z.string().nullable(),

	// Mapping Config
	mapping_config: z.record(z.unknown()).nullable(),

	// Sync Status
	last_sync_at: z.string().optional(),
	last_sync_status: z.string().nullable(),
	last_sync_error: z.string().nullable(),

	// Status
	is_active: z.boolean(),

	// Audit
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type ChannelMappingListItem = z.infer<typeof ChannelMappingListItemSchema>;

/**
 * Channel mapping list response schema.
 */
export const ChannelMappingListResponseSchema = z.object({
	data: z.array(ChannelMappingListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type ChannelMappingListResponse = z.infer<typeof ChannelMappingListResponseSchema>;
/**
 * Reservation list item schema for API responses.
 * Includes display fields derived from enum values and computed fields.
 */
export const ReservationListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	guest_id: uuid.optional(),
	room_type_id: uuid.optional(),
	room_type_name: z.string().optional(),
	confirmation_number: z.string(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	nights: z.number().int().positive(),
	status: z.string(),
	status_display: z.string(),
	source: z.string().optional(),
	guest_name: z.string(),
	guest_email: z.string(),
	guest_phone: z.string().optional(),
	room_number: z.string().optional(),
	total_amount: z.number(),
	paid_amount: z.number().optional(),
	balance_due: z.number().optional(),
	currency: z.string(),
	booking_date: z.string().optional(),
	actual_check_in: z.string().optional(),
	actual_check_out: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	notes: z.string().optional(),
	version: z.string(),
});

export type ReservationListItem = z.infer<typeof ReservationListItemSchema>;

/**
 * Reservation list response schema.
 */
export const ReservationListResponseSchema = z.object({
	data: z.array(ReservationListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type ReservationListResponse = z.infer<typeof ReservationListResponseSchema>;
