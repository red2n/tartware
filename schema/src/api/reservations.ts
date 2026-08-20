/**
 * DEV DOC
 * Module: api/reservations.ts
 * Purpose: Reservation API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";
import type { ReservationCommandLifecycleState } from "../shared/enums.js";

// =====================================================
// RESERVATION DETAIL (single reservation fetch)
// =====================================================

/**
 * Nested folio summary for reservation detail responses.
 */
export const ReservationFolioSummarySchema = z.object({
	folio_id: z.string(),
	folio_status: z.string(),
	total_charges: z.number(),
	total_payments: z.number(),
	total_credits: z.number(),
	balance: z.number(),
});
export type ReservationFolioSummary = z.infer<
	typeof ReservationFolioSummarySchema
>;

/**
 * Status history entry for reservation audit trail.
 */
export const ReservationStatusHistoryEntrySchema = z.object({
	previous_status: z.string(),
	new_status: z.string(),
	change_reason: z.string().optional(),
	changed_by: z.string(),
	changed_at: z.string(),
});
export type ReservationStatusHistoryEntry = z.infer<
	typeof ReservationStatusHistoryEntrySchema
>;

/**
 * Detail schema for single reservation fetch — richer than list item.
 * Includes nested folio summary, status history, and display fields.
 */
export const ReservationDetailSchema = z.object({
	id: z.string(),
	tenant_id: z.string(),
	property_id: z.string(),
	property_name: z.string().optional(),
	guest_id: z.string().optional(),
	guest_name: z.string().optional(),
	guest_email: z.string().optional(),
	guest_phone: z.string().optional(),
	room_type_id: z.string().optional(),
	room_type_name: z.string().optional(),
	rate_id: z.string().optional(),
	confirmation_number: z.string(),
	reservation_type: z.string().optional(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	booking_date: z.string().optional(),
	actual_check_in: z.string().optional(),
	actual_check_out: z.string().optional(),
	nights: z.number(),
	room_number: z.string().optional(),
	number_of_adults: z.number().default(1),
	number_of_children: z.number().default(0),
	room_rate: z.number().default(0),
	total_amount: z.number().default(0),
	tax_amount: z.number().default(0),
	discount_amount: z.number().default(0),
	paid_amount: z.number().default(0),
	balance_due: z.number().default(0),
	currency: z.string().default("USD"),
	status: z.string(),
	status_display: z.string(),
	source: z.string().optional(),
	channel_reference: z.string().optional(),
	guarantee_type: z.string().optional(),
	credit_card_last4: z.string().optional(),
	special_requests: z.string().optional(),
	internal_notes: z.string().optional(),
	cancellation_date: z.string().optional(),
	cancellation_reason: z.string().optional(),
	cancellation_fee: z.number().optional(),
	is_no_show: z.boolean().default(false),
	no_show_date: z.string().optional(),
	no_show_fee: z.number().optional(),
	promo_code: z.string().optional(),
	folio: ReservationFolioSummarySchema.optional(),
	status_history: z.array(ReservationStatusHistoryEntrySchema).optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	version: z.string().default("0"),
});
export type ReservationDetail = z.infer<typeof ReservationDetailSchema>;

// =====================================================
// S23: CHECK-IN BRIEF (Guest Recognition)
// =====================================================

/** Schema for a single guest note shown at check-in. */
export const CheckInNoteSchema = z.object({
	note_id: z.string(),
	note_type: z.string().nullable().optional(),
	note_text: z.string().nullable().optional(),
	alert_level: z.string().nullable().optional(),
	is_alert: z.boolean().optional(),
	status: z.string().nullable().optional(),
});

export type CheckInNote = z.infer<typeof CheckInNoteSchema>;

/** Schema for a single guest preference. */
export const CheckInPreferenceSchema = z.object({
	category: z.string().nullable().optional(),
	preference_type: z.string().nullable().optional(),
	preference_value: z.string().nullable().optional(),
	priority: z.number().nullable().optional(),
	is_mandatory: z.boolean().optional(),
	is_special_request: z.boolean().optional(),
});

export type CheckInPreference = z.infer<typeof CheckInPreferenceSchema>;

/** Schema for the full check-in brief response. */
export const CheckInBriefSchema = z.object({
	reservation_id: z.string(),
	guest_id: z.string().nullable().optional(),
	guest_name: z.string(),
	guest_email: z.string().nullable().optional(),
	guest_phone: z.string().nullable().optional(),
	vip_status: z.string().nullable().optional(),
	loyalty_tier: z.string().nullable().optional(),
	loyalty_points: z.number().nullable().optional(),
	is_blacklisted: z.boolean().optional(),
	total_stays: z.number().optional(),
	total_nights: z.number().optional(),
	total_revenue: z.number().optional(),
	last_stay_date: z.string().nullable().optional(),
	room_number: z.string().nullable().optional(),
	room_type: z.string().nullable().optional(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	special_requests: z.string().nullable().optional(),
	internal_notes: z.string().nullable().optional(),
	reservation_type: z.string().nullable().optional(),
	preferences: z.array(CheckInPreferenceSchema),
	alerts: z.array(CheckInNoteSchema),
	notes: z.array(CheckInNoteSchema),
});

export type CheckInBrief = z.infer<typeof CheckInBriefSchema>;

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
	// Typed, not `z.string()`: both CHECK constraints hold exactly these
	// spellings, and an untyped column is the shape that let the mapper fold
	// them to lower case unnoticed. Same correction COV-13 made to
	// `booking_status`.
	allotment_type: AllotmentTypeEnum,
	allotment_type_display: z.string(),
	allotment_status: AllotmentStatusEnum,
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

/** Commission basis, matching the `commission_type` CHECK constraint. */
export const CommissionTypeEnum = z.enum(["PERCENTAGE", "FIXED", "TIERED", "NONE"]);

export type CommissionType = z.infer<typeof CommissionTypeEnum>;

/**
 * Create a booking source.
 *
 * Performance columns (`total_bookings`, `total_revenue`, `conversion_rate` and
 * the rest) are machine-maintained and deliberately absent: a caller-supplied
 * booking count is how channel-production reporting stops meaning anything.
 *
 * `source_code` is unique per (tenant, property) and stored as typed — it is what
 * reservations carry, so folding its case would orphan existing rows.
 */
// =====================================================
// ALLOTMENT WRITES
// ui-gaps/16-booking-reference-data.md, step 4
// =====================================================

// AllotmentTypeEnum and AllotmentStatusEnum are declared with the read model
// above; both already match their CHECK constraints exactly, so there is nothing
// to re-declare here.

/**
 * Where an allotment may go next.
 *
 * The CHECK constrains the value, not the movement, so the ordering lives here —
 * the same split as `EVENT_BOOKING_LEGAL_TRANSITIONS`, and exported for the same
 * reason: a screen must not offer a move the service will refuse.
 *
 * A block is contracted (TENTATIVE), signed (DEFINITE), open for pickup
 * (ACTIVE → PICKUP_IN_PROGRESS as reservations are drawn from it) and then
 * closed out (COMPLETED). CANCELLED is reachable from anything still live,
 * because a group cancels; COMPLETED and CANCELLED are terminal.
 */
export const ALLOTMENT_LEGAL_TRANSITIONS: Readonly<
	Record<AllotmentStatus, readonly AllotmentStatus[]>
> = Object.freeze({
	TENTATIVE: ["DEFINITE", "ACTIVE", "CANCELLED"],
	DEFINITE: ["ACTIVE", "CANCELLED"],
	ACTIVE: ["PICKUP_IN_PROGRESS", "COMPLETED", "CANCELLED"],
	PICKUP_IN_PROGRESS: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
	CANCELLED: [],
});

const ALLOTMENT_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/**
 * Create an allotment — a contracted block of rooms.
 *
 * Per the 2026-08-19 decision in ui-gaps/16, this is a *distribution contract*,
 * not the inventory side of a group booking: the table has no `group_booking_id`
 * and `group_room_blocks` already fills that role. Hence `booking_source_id` and
 * `market_segment_id` rather than a group link.
 *
 * Bounds mirror the table's CHECK constraints so a bad payload is a 400 and not
 * a 23514.
 */
export const AllotmentWriteBodySchema = z
	.object({
		tenant_id: uuid,
		property_id: uuid,
		allotment_code: z
			.string()
			.min(2)
			.max(50)
			.regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only"),
		allotment_name: z.string().min(1).max(200),
		allotment_type: AllotmentTypeEnum,
		allotment_status: AllotmentStatusEnum.optional(),
		start_date: ALLOTMENT_DATE,
		end_date: ALLOTMENT_DATE,
		cutoff_date: ALLOTMENT_DATE.optional(),
		cutoff_days_prior: z.coerce.number().int().nonnegative().optional(),
		room_type_id: uuid.optional(),
		total_rooms_blocked: z.coerce.number().int().positive(),
		rooms_per_night: z.coerce.number().int().positive().optional(),
		rate_type: z.string().max(30).optional(),
		contracted_rate: z.coerce.number().nonnegative().optional(),
		currency_code: z.string().length(3).optional(),
		account_name: z.string().max(200).optional(),
		account_type: z.string().max(30).optional(),
		billing_type: z.string().max(30).optional(),
		contact_name: z.string().max(200).optional(),
		contact_email: z.string().email().max(255).optional(),
		contact_phone: z.string().max(30).optional(),
		contact_company: z.string().max(200).optional(),
		booking_source_id: uuid.optional(),
		market_segment_id: uuid.optional(),
		channel: z.string().max(50).optional(),
		deposit_required: z.boolean().optional(),
		deposit_amount: z.coerce.number().nonnegative().optional(),
		attrition_clause: z.boolean().optional(),
		attrition_percentage: z.coerce.number().min(0).max(100).optional(),
		guaranteed_rooms: z.coerce.number().int().nonnegative().optional(),
		elastic_limit: z.coerce.number().int().nonnegative().optional(),
		commission_percentage: z.coerce.number().min(0).max(100).optional(),
		is_vip: z.boolean().optional(),
		priority_level: z.coerce.number().int().optional(),
		notes: z.string().optional(),
		internal_notes: z.string().optional(),
	})
	.refine((v) => v.end_date >= v.start_date, {
		message: "end_date cannot fall before start_date",
		path: ["end_date"],
	})
	.refine((v) => !v.cutoff_date || v.cutoff_date <= v.start_date, {
		// A cutoff after arrival releases rooms nobody can still book.
		message: "cutoff_date must fall on or before start_date",
		path: ["cutoff_date"],
	});

export type AllotmentWriteBody = z.infer<typeof AllotmentWriteBodySchema>;

/**
 * Edit an allotment. `allotment_code` is fixed: it is the reference the contract
 * and any channel mapping quote, so rewriting it orphans them. Status moves
 * through its own route, where the transition can be checked.
 */
export const AllotmentUpdateBodySchema = z.object({
	tenant_id: uuid,
	allotment_name: z.string().min(1).max(200).optional(),
	allotment_type: AllotmentTypeEnum.optional(),
	cutoff_date: ALLOTMENT_DATE.optional(),
	cutoff_days_prior: z.coerce.number().int().nonnegative().optional(),
	room_type_id: uuid.optional(),
	total_rooms_blocked: z.coerce.number().int().positive().optional(),
	rooms_per_night: z.coerce.number().int().positive().optional(),
	rooms_picked_up: z.coerce.number().int().nonnegative().optional(),
	rate_type: z.string().max(30).optional(),
	contracted_rate: z.coerce.number().nonnegative().optional(),
	account_name: z.string().max(200).optional(),
	account_type: z.string().max(30).optional(),
	billing_type: z.string().max(30).optional(),
	contact_name: z.string().max(200).optional(),
	contact_email: z.string().email().max(255).optional(),
	contact_phone: z.string().max(30).optional(),
	contact_company: z.string().max(200).optional(),
	booking_source_id: uuid.optional(),
	market_segment_id: uuid.optional(),
	channel: z.string().max(50).optional(),
	deposit_required: z.boolean().optional(),
	deposit_amount: z.coerce.number().nonnegative().optional(),
	attrition_clause: z.boolean().optional(),
	attrition_percentage: z.coerce.number().min(0).max(100).optional(),
	guaranteed_rooms: z.coerce.number().int().nonnegative().optional(),
	elastic_limit: z.coerce.number().int().nonnegative().optional(),
	commission_percentage: z.coerce.number().min(0).max(100).optional(),
	is_vip: z.boolean().optional(),
	priority_level: z.coerce.number().int().optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
});

export type AllotmentUpdateBody = z.infer<typeof AllotmentUpdateBodySchema>;

/**
 * Move an allotment through its lifecycle. Confirming stamps `confirmed_at`,
 * activating `activated_at`, completing `completed_at` and cancelling
 * `cancelled_at` plus the reason — so "when was this block signed" and "why did
 * it go away" stay answerable.
 */
export const AllotmentStatusBodySchema = z.object({
	tenant_id: uuid,
	allotment_status: AllotmentStatusEnum,
	cancellation_reason: z.string().max(500).optional(),
});

export type AllotmentStatusBody = z.infer<typeof AllotmentStatusBodySchema>;

/** Service-layer input for an allotment write, per AGENTS.md. */
export type AllotmentWriteInput = {
	propertyId?: string;
	allotmentCode?: string;
	allotmentName?: string;
	allotmentType?: string;
	allotmentStatus?: string;
	startDate?: string;
	endDate?: string;
	cutoffDate?: string;
	cutoffDaysPrior?: number;
	roomTypeId?: string;
	totalRoomsBlocked?: number;
	roomsPerNight?: number;
	roomsPickedUp?: number;
	rateType?: string;
	contractedRate?: number;
	currencyCode?: string;
	accountName?: string;
	accountType?: string;
	billingType?: string;
	contactName?: string;
	contactEmail?: string;
	contactPhone?: string;
	contactCompany?: string;
	bookingSourceId?: string;
	marketSegmentId?: string;
	channel?: string;
	depositRequired?: boolean;
	depositAmount?: number;
	attritionClause?: boolean;
	attritionPercentage?: number;
	guaranteedRooms?: number;
	elasticLimit?: number;
	commissionPercentage?: number;
	isVip?: boolean;
	priorityLevel?: number;
	notes?: string;
	internalNotes?: string;
};

export const BookingSourceWriteBodySchema = z
	.object({
		tenant_id: uuid,
		property_id: uuid.optional(),
		source_code: z
			.string()
			.min(2)
			.max(50)
			.regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only"),
		source_name: z.string().min(1).max(200),
		source_type: BookingSourceTypeEnum,
		category: z.string().max(50).optional(),
		sub_category: z.string().max(50).optional(),
		is_active: z.boolean().optional(),
		is_bookable: z.boolean().optional(),
		channel_name: z.string().max(200).optional(),
		channel_website: z.string().max(500).optional(),
		channel_manager: z.string().max(100).optional(),
		commission_type: CommissionTypeEnum.optional(),
		commission_percentage: z.coerce.number().min(0).max(100).optional(),
		commission_fixed_amount: z.coerce.number().nonnegative().optional(),
		commission_notes: z.string().optional(),
		ranking: z.coerce.number().int().optional(),
		is_preferred: z.boolean().optional(),
	})
	.refine(
		(body) => body.commission_type !== "PERCENTAGE" || body.commission_percentage != null,
		{
			message: "commission_percentage is required for a percentage commission",
			path: ["commission_percentage"],
		},
	)
	.refine((body) => body.commission_type !== "FIXED" || body.commission_fixed_amount != null, {
		message: "commission_fixed_amount is required for a fixed commission",
		path: ["commission_fixed_amount"],
	});

export type BookingSourceWriteBody = z.infer<typeof BookingSourceWriteBodySchema>;

/** Edit a booking source. `source_code` is fixed — reservations reference it. */
export const BookingSourceUpdateBodySchema = z.object({
	tenant_id: uuid,
	source_name: z.string().min(1).max(200).optional(),
	source_type: BookingSourceTypeEnum.optional(),
	category: z.string().max(50).optional(),
	sub_category: z.string().max(50).optional(),
	is_active: z.boolean().optional(),
	is_bookable: z.boolean().optional(),
	channel_name: z.string().max(200).optional(),
	channel_website: z.string().max(500).optional(),
	channel_manager: z.string().max(100).optional(),
	commission_type: CommissionTypeEnum.optional(),
	commission_percentage: z.coerce.number().min(0).max(100).optional(),
	commission_fixed_amount: z.coerce.number().nonnegative().optional(),
	commission_notes: z.string().optional(),
	ranking: z.coerce.number().int().optional(),
	is_preferred: z.boolean().optional(),
});

export type BookingSourceUpdateBody = z.infer<typeof BookingSourceUpdateBodySchema>;

/** Service-layer input for a booking source write, per AGENTS.md. */
export type BookingSourceWriteInput = {
	sourceCode: string;
	sourceName: string;
	sourceType: string;
	propertyId?: string;
	category?: string;
	subCategory?: string;
	isActive?: boolean;
	isBookable?: boolean;
	channelName?: string;
	channelWebsite?: string;
	channelManager?: string;
	commissionType?: string;
	commissionPercentage?: number;
	commissionFixedAmount?: number;
	commissionNotes?: string;
	ranking?: number;
	isPreferred?: boolean;
};

/**
 * Booking source list response schema.
 */
export const BookingSourceListResponseSchema = z.object({
	data: z.array(BookingSourceListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type BookingSourceListResponse = z.infer<
	typeof BookingSourceListResponseSchema
>;

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
 * Create a market segment.
 *
 * `/v1/reports/market-segment-production` already reads these, so segments are
 * load-bearing for reporting before anything can create one — the report has been
 * grouping by a dimension nobody could populate. Volume and behaviour columns are
 * machine-maintained and not settable.
 */
export const MarketSegmentWriteBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	segment_code: z
		.string()
		.min(2)
		.max(50)
		.regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only"),
	segment_name: z.string().min(1).max(200),
	segment_type: MarketSegmentTypeEnum,
	is_active: z.boolean().optional(),
	is_bookable: z.boolean().optional(),
	parent_segment_id: uuid.optional(),
	rate_multiplier: z.coerce.number().positive().optional(),
});

export type MarketSegmentWriteBody = z.infer<typeof MarketSegmentWriteBodySchema>;

/** Edit a market segment. `segment_code` is fixed — reservations reference it. */
export const MarketSegmentUpdateBodySchema = z.object({
	tenant_id: uuid,
	segment_name: z.string().min(1).max(200).optional(),
	segment_type: MarketSegmentTypeEnum.optional(),
	is_active: z.boolean().optional(),
	is_bookable: z.boolean().optional(),
	parent_segment_id: uuid.optional(),
	rate_multiplier: z.coerce.number().positive().optional(),
});

export type MarketSegmentUpdateBody = z.infer<typeof MarketSegmentUpdateBodySchema>;

/** Service-layer input for a market segment write, per AGENTS.md. */
export type MarketSegmentWriteInput = {
	segmentCode: string;
	segmentName: string;
	segmentType: string;
	propertyId?: string;
	isActive?: boolean;
	isBookable?: boolean;
	parentSegmentId?: string;
	rateMultiplier?: number;
};

/**
 * Market segment list response schema.
 */
export const MarketSegmentListResponseSchema = z.object({
	data: z.array(MarketSegmentListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type MarketSegmentListResponse = z.infer<
	typeof MarketSegmentListResponseSchema
>;

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

export type ChannelMappingListItem = z.infer<
	typeof ChannelMappingListItemSchema
>;

/**
 * Channel mapping list response schema.
 */
export const ChannelMappingListResponseSchema = z.object({
	data: z.array(ChannelMappingListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type ChannelMappingListResponse = z.infer<
	typeof ChannelMappingListResponseSchema
>;
/**
 * Reservation grid row schema for list/table responses.
 * Keeps only fields required by the reservations grid and its client-side filters.
 */
export const ReservationGridItemSchema = z.object({
	id: uuid,
	confirmation_number: z.string(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	nights: z.number().int().positive(),
	status: z.string(),
	status_display: z.string(),
	source: z.string().optional(),
	reservation_type: z.string().optional(),
	guest_name: z.string(),
	guest_email: z.string(),
	room_type_name: z.string().optional(),
	room_number: z.string().optional(),
	total_amount: z.number(),
	currency: z.string(),
});

export type ReservationGridItem = z.infer<typeof ReservationGridItemSchema>;

/**
 * Reservation grid response schema.
 */
export const ReservationGridResponseSchema = z.object({
	data: z.array(ReservationGridItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type ReservationGridResponse = z.infer<
	typeof ReservationGridResponseSchema
>;

/**
 * Reservation list item schema for full reservation row/edit workflows.
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
	reservation_type: z.string().optional(),
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
 * Full reservation list response schema.
 */
export const ReservationListResponseSchema = z.object({
	data: z.array(ReservationListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type ReservationListResponse = z.infer<
	typeof ReservationListResponseSchema
>;

/**
 * Raw SQL row shape for reservation grid queries.
 */
export type ReservationGridRow = {
	id: string;
	room_type_name: string | null;
	confirmation_number: string;
	check_in_date: string | Date | null;
	check_out_date: string | Date | null;
	room_number: string | null;
	total_amount: number | string | null;
	currency: string | null;
	status: string | null;
	source: string | null;
	reservation_type: string | null;
	guest_name: string;
	guest_email: string;
	nights: number | string | null;
};

/**
 * Raw SQL row shape for full reservation list queries.
 */
export type ReservationListRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	guest_id: string | null;
	room_type_id: string | null;
	room_type_name: string | null;
	confirmation_number: string;
	check_in_date: string | Date | null;
	check_out_date: string | Date | null;
	booking_date: string | Date | null;
	actual_check_in: string | Date | null;
	actual_check_out: string | Date | null;
	room_number: string | null;
	total_amount: number | string | null;
	paid_amount: number | string | null;
	balance_due: number | string | null;
	currency: string | null;
	status: string | null;
	source: string | null;
	reservation_type: string | null;
	guest_name: string;
	guest_email: string;
	guest_phone: string | null;
	special_requests: string | null;
	internal_notes: string | null;
	created_at: string | Date;
	updated_at: string | Date | null;
	version: bigint | null;
	nights: number | string | null;
};
// =====================================================
// RESERVATION COMMAND SERVICE DOMAIN TYPES
// =====================================================

/** Lightweight reservation stay snapshot for availability and command processing. */
export type ReservationStaySnapshot = {
	reservationId: string;
	tenantId: string;
	propertyId: string;
	roomTypeId: string;
	checkInDate: Date;
	checkOutDate: Date;
	guestId: string;
	status: string;
};

/** Cancellation policy JSONB shape stored on the rates table. */
export type CancellationPolicy = {
	/** Policy type: "flexible", "moderate", "strict", "non_refundable" */
	type: string;
	/** Hours before check-in deadline */
	hours: number;
	/** Fee amount (currency-relative) */
	penalty: number;
};

/** Reservation data needed for cancellation fee calculation. */
export type ReservationCancellationInfo = {
	reservationId: string;
	tenantId: string;
	propertyId: string;
	roomTypeId: string;
	rateId: string | null;
	roomRate: number;
	totalAmount: number;
	checkInDate: Date;
	checkOutDate: Date;
	status: string;
	cancellationPolicy: CancellationPolicy | null;
};

/** Rate plan resolution output including fallback metadata. */
export type RatePlanResolution = {
	appliedRateCode: string;
	rateId?: string;
	requestedRateCode?: string;
	fallbackApplied: boolean;
	reason?: string;
	decidedAt: Date;
	/** Snapshot of the rate's cancellation_policy JSONB at resolution time (for booking-time freeze). */
	cancellationPolicySnapshot?: CancellationPolicy | null;
};

/** Result returned when a reservation command is accepted and enqueued. */
export interface CreateReservationResult {
	eventId: string;
	correlationId?: string;
	status: "accepted";
}

// =====================================================
// REPOSITORY INPUT/ROW TYPES
// =====================================================

/** Input for inserting an initial lifecycle record when a command event arrives. */
export type LifecycleInsertInput = {
	eventId: string;
	tenantId: string;
	reservationId?: string;
	commandName: string;
	correlationId?: string;
	partitionKey?: string;
	details?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
};

/** Input for advancing an existing lifecycle record to a new state. */
export type LifecycleUpdateInput = {
	eventId: string;
	state: ReservationCommandLifecycleState;
	details?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
};

/** DB row shape for the minimal reservation data needed to compute cancellations. */
export type ReservationStayRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	room_type_id: string;
	check_in_date: Date;
	check_out_date: Date;
	guest_id: string;
	status: string;
};

/** Result shape returned by reservation event handler functions. */
export type ReservationEventHandlerResult = {
	reservationId?: string;
};

/** Parameters for auto-creating a folio when a reservation is created. */
export type CreateFolioParams = {
	reservationId: string;
	tenantId: string;
	propertyId: string;
	guestId: string;
	guestName: string;
	currency: string;
};

/** Input for upserting a processed event offset record. */
export type UpsertReservationEventOffsetInput = {
	tenantId: string;
	consumerGroup: string;
	topic: string;
	partition: number;
	offset: string;
	eventId?: string;
	reservationId?: string;
	correlationId?: string;
	metadata?: Record<string, unknown>;
};

// =============================================================================
// RESERVATION COMMAND SERVICE — reliability types
// =============================================================================

/** Health snapshot for the reservation command pipeline (Kafka consumer + DLQ + outbox). */
export type ReliabilitySnapshot = {
	status: "healthy" | "degraded" | "critical";
	generatedAt: string;
	issues: string[];
	outbox: {
		pending: number;
		warnThreshold: number;
		criticalThreshold: number;
	};
	consumer: {
		partitions: number;
		stalePartitions: number;
		maxSecondsSinceCommit: number | null;
		staleThresholdSeconds: number;
	};
	lifecycle: {
		stalledCommands: number;
		oldestStuckSeconds: number | null;
		dlqTotal: number;
		stalledThresholdSeconds: number;
	};
	dlq: {
		depth: number | null;
		warnThreshold: number;
		criticalThreshold: number;
		topic: string;
		error: string | null;
	};
};
