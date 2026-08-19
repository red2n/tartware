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
// DAY-BOUNDARY CONVENTION FOR EVENT TIMES
// =====================================================

/**
 * Pads HH:MM to HH:MM:SS so two times compare correctly as strings.
 * Without this, "09:00" < "09:00:00" lexicographically and a zero-length
 * booking would slip past the ordering refinements below.
 */
export const padTimeOfDay = (value: string): string =>
	value.length === 5 ? `${value}:00` : value;

/**
 * `event_bookings` and `banquet_event_orders` both store one `event_date DATE`
 * plus bare `TIME` columns. That representation cannot say "01:00 tomorrow" on
 * its own, which is why an evening function running past midnight was rejected
 * by the tables themselves — see ui-gaps/13-sales-catering.md.
 *
 * **The convention that fixes it, and the only one anything may assume:**
 * the booking is anchored at `event_date + start_time`, and runs forward from
 * there. Every other time-of-day on the row is read relative to that anchor:
 *
 * - `end_time` / `teardown_end_time` at or before `start_time` fall on the
 *   **next** day. A wedding 18:00 → 01:00 ends at 01:00 the following morning.
 * - `setup_start_time` after `start_time` falls on the **previous** day. A gala
 *   starting 00:30 with setup at 22:00 is dressed the evening before.
 *
 * Under this rule every combination of times denotes exactly one instant, so
 * there is no such thing as an out-of-order window — which is why the tables'
 * ordering CHECKs are now only "not zero-length", and why
 * `event_bookings_setup_time_check` was dropped outright rather than relaxed.
 *
 * The cost is that a mistyped time is silently a different day rather than a
 * 400. The UI pays that back by labelling any window that crosses midnight, so
 * the operator sees the day the system inferred.
 *
 * Postgres holds the same rule for stored rows in the `occupancy_starts_at` /
 * `occupancy_ends_at` generated columns on `event_bookings`; these helpers are
 * the TypeScript half, for validation and display.
 */
export const eventEndsNextDay = (startTime: string, endTime: string): boolean =>
	padTimeOfDay(endTime) <= padTimeOfDay(startTime);

/**
 * True when `setup_start_time` denotes the evening before the event, per the
 * convention documented on {@link eventEndsNextDay}.
 */
export const eventSetupStartsPreviousDay = (
	startTime: string,
	setupStartTime: string,
): boolean => padTimeOfDay(setupStartTime) > padTimeOfDay(startTime);

/** Shifts a YYYY-MM-DD date by whole days, UTC so no zone can move it. */
const shiftIsoDate = (isoDate: string, days: number): string => {
	const shifted = new Date(`${isoDate}T00:00:00Z`);
	shifted.setUTCDate(shifted.getUTCDate() + days);
	return shifted.toISOString().slice(0, 10);
};

/**
 * The instants an event booking holds its space, setup and teardown included.
 *
 * This is the TypeScript half of the `occupancy_starts_at` /
 * `occupancy_ends_at` generated columns on `event_bookings`, and it must stay
 * identical to them: the double-booking check compares a proposed booking
 * resolved by this function against stored rows resolved by Postgres. Any drift
 * between the two shows up as a conflict that is missed or invented, which is
 * why `http_test/smoke-events.sh` asserts a cross-midnight conflict is caught.
 *
 * @returns `YYYY-MM-DD HH:MM:SS` strings, ready to bind as `::timestamp`.
 */
export const resolveEventOccupancyWindow = (
	eventDate: string,
	startTime: string,
	endTime: string,
	setupStartTime?: string | null,
	teardownEndTime?: string | null,
): { startsAt: string; endsAt: string } => {
	const occupancyStart = setupStartTime || startTime;
	const occupancyEnd = teardownEndTime || endTime;
	const startDate = eventSetupStartsPreviousDay(startTime, occupancyStart)
		? shiftIsoDate(eventDate, -1)
		: eventDate;
	const endDate = eventEndsNextDay(startTime, occupancyEnd)
		? shiftIsoDate(eventDate, 1)
		: eventDate;
	return {
		startsAt: `${startDate} ${padTimeOfDay(occupancyStart)}`,
		endsAt: `${endDate} ${padTimeOfDay(occupancyEnd)}`,
	};
};

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

/**
 * Create a meeting room. Reference data, so plain HTTP on the owning service
 * per ui-gaps/18-write-path-gap.md. See ui-gaps/13-sales-catering.md.
 *
 * The numeric bounds here mirror the table's CHECK constraints
 * (`max_capacity > 0`, `area_* > 0`, `hourly_rate >= 0`, setup/teardown/turnover
 * `>= 0`) so a bad payload is a 400 from zod rather than a 23514 from Postgres.
 *
 * Unlike a booking source, `room_code` is editable: `event_bookings` and
 * `banquet_event_orders` both reference `room_id`, not the code. It is still
 * unique per (tenant, property).
 */
export const MeetingRoomWriteBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	room_code: z
		.string()
		.min(2)
		.max(50)
		.regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only"),
	room_name: z.string().min(1).max(200),
	room_type: MeetingRoomTypeEnum,
	room_status: MeetingRoomStatusEnum.optional(),
	max_capacity: z.coerce.number().int().positive(),

	// Location
	building: z.string().max(100).optional(),
	floor: z.coerce.number().int().optional(),
	location_description: z.string().max(500).optional(),

	// Capacity by layout
	theater_capacity: z.coerce.number().int().nonnegative().optional(),
	classroom_capacity: z.coerce.number().int().nonnegative().optional(),
	banquet_capacity: z.coerce.number().int().nonnegative().optional(),
	reception_capacity: z.coerce.number().int().nonnegative().optional(),
	u_shape_capacity: z.coerce.number().int().nonnegative().optional(),
	boardroom_capacity: z.coerce.number().int().nonnegative().optional(),

	// Physical dimensions
	area_sqm: z.coerce.number().positive().optional(),
	area_sqft: z.coerce.number().positive().optional(),
	length_meters: z.coerce.number().positive().optional(),
	width_meters: z.coerce.number().positive().optional(),
	ceiling_height_meters: z.coerce.number().positive().optional(),

	// Features
	has_natural_light: z.boolean().optional(),
	has_audio_visual: z.boolean().optional(),
	has_video_conferencing: z.boolean().optional(),
	has_wifi: z.boolean().optional(),
	has_stage: z.boolean().optional(),
	has_dance_floor: z.boolean().optional(),
	wheelchair_accessible: z.boolean().optional(),

	// Setup
	default_setup: z.string().max(50).optional(),
	setup_time_minutes: z.coerce.number().int().nonnegative().optional(),
	teardown_time_minutes: z.coerce.number().int().nonnegative().optional(),
	turnover_time_minutes: z.coerce.number().int().nonnegative().optional(),

	// Pricing
	hourly_rate: z.coerce.number().nonnegative().optional(),
	half_day_rate: z.coerce.number().nonnegative().optional(),
	full_day_rate: z.coerce.number().nonnegative().optional(),
	minimum_rental_hours: z.coerce.number().int().nonnegative().optional(),
	currency_code: z.string().length(3).optional(),

	// Operating hours
	operating_hours_start: z
		.string()
		.regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM or HH:MM:SS")
		.optional(),
	operating_hours_end: z
		.string()
		.regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM or HH:MM:SS")
		.optional(),

	// Catering
	catering_required: z.boolean().optional(),
	in_house_catering_available: z.boolean().optional(),
	external_catering_allowed: z.boolean().optional(),

	// Media
	primary_photo_url: z.string().max(500).optional(),
	floor_plan_url: z.string().max(500).optional(),
	virtual_tour_url: z.string().max(500).optional(),

	// Status
	is_active: z.boolean().optional(),
	requires_approval: z.boolean().optional(),
});

export type MeetingRoomWriteBody = z.infer<typeof MeetingRoomWriteBodySchema>;

/** Edit a meeting room. Every field optional but `tenant_id`. */
export const MeetingRoomUpdateBodySchema = MeetingRoomWriteBodySchema.partial()
	.omit({ tenant_id: true, property_id: true })
	.extend({ tenant_id: uuid });

export type MeetingRoomUpdateBody = z.infer<typeof MeetingRoomUpdateBodySchema>;

/** Service-layer input for a meeting room write, per AGENTS.md. */
export type MeetingRoomWriteInput = {
	propertyId?: string;
	roomCode?: string;
	roomName?: string;
	roomType?: MeetingRoomType;
	roomStatus?: MeetingRoomStatus;
	maxCapacity?: number;
	building?: string;
	floor?: number;
	locationDescription?: string;
	theaterCapacity?: number;
	classroomCapacity?: number;
	banquetCapacity?: number;
	receptionCapacity?: number;
	uShapeCapacity?: number;
	boardroomCapacity?: number;
	areaSqm?: number;
	areaSqft?: number;
	lengthMeters?: number;
	widthMeters?: number;
	ceilingHeightMeters?: number;
	hasNaturalLight?: boolean;
	hasAudioVisual?: boolean;
	hasVideoConferencing?: boolean;
	hasWifi?: boolean;
	hasStage?: boolean;
	hasDanceFloor?: boolean;
	wheelchairAccessible?: boolean;
	defaultSetup?: string;
	setupTimeMinutes?: number;
	teardownTimeMinutes?: number;
	turnoverTimeMinutes?: number;
	hourlyRate?: number;
	halfDayRate?: number;
	fullDayRate?: number;
	minimumRentalHours?: number;
	currencyCode?: string;
	operatingHoursStart?: string;
	operatingHoursEnd?: string;
	cateringRequired?: boolean;
	inHouseCateringAvailable?: boolean;
	externalCateringAllowed?: boolean;
	primaryPhotoUrl?: string;
	floorPlanUrl?: string;
	virtualTourUrl?: string;
	isActive?: boolean;
	requiresApproval?: boolean;
};

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
	// Typed, not `z.string()`. The CHECK on `event_bookings.booking_status` holds
	// exactly these eight values in exactly this spelling, and an untyped column is
	// precisely the shape that let enum/CHECK case drift go unnoticed elsewhere.
	booking_status: EventBookingStatusEnum,
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
 * The single-booking read model — everything the list carries, plus the fields
 * only the detail screen needs.
 *
 * Split rather than widened because the list query does not select these: the
 * function space calendar loads a month of bookings at a time and has no use for
 * billing instructions or internal notes. `folio_id` and `group_booking_id` are
 * the §2 billing linkage recorded in ui-gaps/13-sales-catering.md — independent
 * pointers, either, both or neither.
 */
export const EventBookingDetailSchema = EventBookingListItemSchema.extend({
	teardown_end_time: z.string().nullable(),
	contact_person: z.string().nullable(),
	contact_email: z.string().nullable(),
	contact_phone: z.string().nullable(),
	group_booking_id: uuid.nullable(),
	folio_id: uuid.nullable(),
	setup_details: z.string().nullable(),
	special_requests: z.string().nullable(),
	internal_notes: z.string().nullable(),
	billing_instructions: z.string().nullable(),
	billing_contact_name: z.string().nullable(),
	billing_contact_email: z.string().nullable(),
	cancellation_date: z.string().nullable(),
	cancellation_notes: z.string().nullable(),
});

export type EventBookingDetail = z.infer<typeof EventBookingDetailSchema>;

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

/**
 * Envelope returned by the event booking write routes — create, update and the
 * lifecycle transition all reply `{ data, message }`.
 *
 * It exists because declaring the bare item as the route's success response made
 * fast-json-stringify reject every successful write with `"event_id" is
 * required!` — a 500 raised *after* the row had already been inserted, so the
 * caller saw a failure for a write that had in fact happened. Mirrors
 * `AmenityResponseSchema`.
 */
export const EventBookingWriteResponseSchema = z.object({
	data: EventBookingDetailSchema,
	message: z.string(),
});

export type EventBookingWriteResponse = z.infer<
	typeof EventBookingWriteResponseSchema
>;

/**
 * Create an event booking.
 *
 * Slice 2 of ui-gaps/13-sales-catering.md — plain HTTP on the owning service per
 * COV-18's rule (one table, one service, no fan-out).
 *
 * Required fields mirror the table's NOT NULL columns with no default:
 * `event_name`, `event_type`, `meeting_room_id`, `event_date`, `start_time`,
 * `end_time`, `organizer_name`, `expected_attendees`, `setup_type`.
 *
 * Bounds mirror the table's CHECK constraints so a bad payload is a 400, not a
 * 23514: `event_bookings_attendees_check` (expected_attendees > 0),
 * `event_bookings_time_check` (end_time <> start_time), enforced by the
 * cross-field refinement below. There is no setup-ordering bound: see the
 * day-boundary convention on {@link eventEndsNextDay}.
 *
 * Billing linkage per the §2 decision recorded in ui-gaps/13: `folio_id` is the
 * event's own folio, `group_booking_id` links it to a group block when the event
 * belongs to one. Both are optional and independent.
 */
/** `TIME` column input: HH:MM or HH:MM:SS, matching the meeting-room fields. */
const TIME_OF_DAY = z
	.string()
	.regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM or HH:MM:SS");

const EventBookingWriteFieldsSchema = z.object({
	tenant_id: uuid,
	property_id: uuid,

	// Event information
	event_number: z.string().max(50).optional(),
	event_name: z.string().min(1).max(200),
	event_type: EventTypeEnum,

	// Space and schedule
	meeting_room_id: uuid,
	event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
	start_time: TIME_OF_DAY,
	end_time: TIME_OF_DAY,
	setup_start_time: TIME_OF_DAY.optional(),
	teardown_end_time: TIME_OF_DAY.optional(),

	// Organizer
	organizer_name: z.string().min(1).max(200),
	organizer_company: z.string().max(200).optional(),
	organizer_email: z.string().email().max(200).optional(),
	organizer_phone: z.string().max(20).optional(),
	contact_person: z.string().max(200).optional(),
	contact_email: z.string().email().max(200).optional(),
	contact_phone: z.string().max(20).optional(),

	// Linked entities
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	company_id: uuid.optional(),
	group_booking_id: uuid.optional(),

	// Attendance
	expected_attendees: z.coerce.number().int().positive(),
	confirmed_attendees: z.coerce.number().int().nonnegative().optional(),
	guarantee_number: z.coerce.number().int().nonnegative().optional(),

	// Setup
	setup_type: EventSetupTypeEnum,
	setup_details: z.string().optional(),
	special_requests: z.string().optional(),
	catering_required: z.boolean().optional(),
	audio_visual_needed: z.boolean().optional(),

	// Status — defaults to TENTATIVE at the table
	booking_status: EventBookingStatusEnum.optional(),

	// Key dates
	beo_due_date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
		.optional(),
	final_count_due_date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
		.optional(),

	// Financial
	rental_rate: z.coerce.number().nonnegative().optional(),
	estimated_total: z.coerce.number().nonnegative().optional(),
	deposit_required: z.coerce.number().nonnegative().optional(),
	currency_code: z.string().length(3).optional(),

	// Billing — see §2 decision in ui-gaps/13-sales-catering.md
	folio_id: uuid.optional(),
	billing_instructions: z.string().optional(),
	billing_contact_name: z.string().max(200).optional(),
	billing_contact_email: z.string().email().max(200).optional(),
});

/**
 * `end_time <> start_time`, mirroring the relaxed `event_bookings_time_check`.
 *
 * This used to require `end_time > start_time` and a setup at or before the
 * start, mirroring the tables' original CHECKs. Both are gone: under the
 * day-boundary convention on {@link eventEndsNextDay} an end at or before the
 * start is the next morning and a late setup is the previous evening, so the
 * only window that denotes nothing at all is a zero-length one.
 */
const refineEventTimes = <T extends z.ZodTypeAny>(schema: T) =>
	schema.refine(
		(value: { start_time?: string; end_time?: string }) =>
			!value.start_time ||
			!value.end_time ||
			padTimeOfDay(value.end_time) !== padTimeOfDay(value.start_time),
		{
			message: "end_time must differ from start_time",
			path: ["end_time"],
		},
	);

export const EventBookingWriteBodySchema = refineEventTimes(
	EventBookingWriteFieldsSchema,
);

export type EventBookingWriteBody = z.infer<typeof EventBookingWriteBodySchema>;

/** Edit an event booking. Every field optional but `tenant_id`. */
export const EventBookingUpdateBodySchema = refineEventTimes(
	EventBookingWriteFieldsSchema.partial()
		.omit({ tenant_id: true, property_id: true })
		.extend({ tenant_id: uuid }),
);

export type EventBookingUpdateBody = z.infer<
	typeof EventBookingUpdateBodySchema
>;

/**
 * The legal lifecycle movements for an event booking.
 *
 * The table's CHECK constrains the *value* of `booking_status`, not the movement
 * between values, so the ordering rule has to live somewhere. It lives here
 * rather than in the service because both ends need it: core-service rejects an
 * illegal move with 409, and the UI uses it to offer only the moves that will be
 * accepted. Two copies would drift, and the drift would show up as a screen
 * offering a button that always fails.
 *
 * COMPLETED and NO_SHOW are terminal; CANCELLED is reachable from any live status.
 */
export const EVENT_BOOKING_LEGAL_TRANSITIONS: Record<
	EventBookingStatus,
	readonly EventBookingStatus[]
> = {
	INQUIRY: ["TENTATIVE", "DEFINITE", "CANCELLED"],
	TENTATIVE: ["DEFINITE", "CONFIRMED", "CANCELLED"],
	DEFINITE: ["CONFIRMED", "IN_PROGRESS", "CANCELLED"],
	CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
	IN_PROGRESS: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
	CANCELLED: [],
	NO_SHOW: [],
};

/**
 * Lifecycle transition — tentative → definite → cancelled and the rest.
 *
 * Separate from the general update because a status change is an operator
 * action with its own audit meaning, and because the legal transitions are
 * enforced in the service rather than by the table's CHECK.
 */
export const EventBookingStatusChangeBodySchema = z.object({
	tenant_id: uuid,
	booking_status: EventBookingStatusEnum,
	cancellation_reason: z.string().max(500).optional(),
});

export type EventBookingStatusChangeBody = z.infer<
	typeof EventBookingStatusChangeBodySchema
>;

/** Service-layer input for an event booking write, per AGENTS.md. */
export type EventBookingWriteInput = {
	propertyId?: string;
	eventNumber?: string;
	eventName?: string;
	eventType?: EventType;
	meetingRoomId?: string;
	eventDate?: string;
	startTime?: string;
	endTime?: string;
	setupStartTime?: string;
	teardownEndTime?: string;
	organizerName?: string;
	organizerCompany?: string;
	organizerEmail?: string;
	organizerPhone?: string;
	contactPerson?: string;
	contactEmail?: string;
	contactPhone?: string;
	guestId?: string;
	reservationId?: string;
	companyId?: string;
	groupBookingId?: string;
	expectedAttendees?: number;
	confirmedAttendees?: number;
	guaranteeNumber?: number;
	setupType?: EventSetupType;
	setupDetails?: string;
	specialRequests?: string;
	cateringRequired?: boolean;
	audioVisualNeeded?: boolean;
	bookingStatus?: EventBookingStatus;
	beoDueDate?: string;
	finalCountDueDate?: string;
	rentalRate?: number;
	estimatedTotal?: number;
	depositRequired?: number;
	currencyCode?: string;
	folioId?: string;
	billingInstructions?: string;
	billingContactName?: string;
	billingContactEmail?: string;
};

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
/**
 * An OTA connection as configured — credentials, endpoint and sync settings.
 *
 * This is the real connections domain. `/v1/ota-connections` is a projection of
 * `channel_mappings` (room-type/rate mappings) despite the name, and had nothing
 * to do with the credentials an operator sets up. `ota_configurations` is what
 * `integration.ota.content_sync` means by `ota_config_id`, and until 2026-08-13
 * nothing served it. See ui-gaps/14-channel-distribution.md.
 *
 * **`api_key` and `api_secret` are deliberately absent.** They are never returned;
 * `has_credentials` reports only whether they are set, so a screen can show a
 * connection as configured without the secret crossing the wire.
 */
export const OtaConfigurationListItemSchema = z.object({
	ota_config_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	ota_name: z.string(),
	ota_code: z.string(),
	api_endpoint: z.string().nullable(),
	hotel_id: z.string().nullable(),
	channel_manager: z.string().nullable(),
	/** Whether an api_key/api_secret pair is stored — never the values themselves. */
	has_credentials: z.boolean(),
	is_active: z.boolean(),
	sync_enabled: z.boolean(),
	sync_frequency_minutes: z.number().int().nullable(),
	last_sync_at: z.string().optional(),
	sync_status: z.string().nullable(),
	sync_error_message: z.string().nullable(),
	rate_push_enabled: z.boolean(),
	availability_push_enabled: z.boolean(),
	reservation_pull_enabled: z.boolean(),
	commission_percentage: z.string().nullable(),
	currency_code: z.string().nullable(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
});

export type OtaConfigurationListItem = z.infer<typeof OtaConfigurationListItemSchema>;

/** Raw row for {@link OtaConfigurationListItemSchema}. */
export type OtaConfigurationRow = {
	ota_config_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	ota_name: string;
	ota_code: string;
	api_endpoint: string | null;
	hotel_id: string | null;
	channel_manager: string | null;
	has_credentials: boolean;
	is_active: boolean;
	sync_enabled: boolean;
	sync_frequency_minutes: number | null;
	last_sync_at: Date | string | null;
	sync_status: string | null;
	sync_error_message: string | null;
	rate_push_enabled: boolean;
	availability_push_enabled: boolean;
	reservation_pull_enabled: boolean;
	commission_percentage: string | null;
	currency_code: string | null;
	created_at: Date | string | null;
	updated_at: Date | string | null;
};

/** Query parameters for listing OTA configurations. */
export type ListOtaConfigurationsInput = {
	tenantId: string;
	propertyId?: string;
	isActive?: boolean;
	limit?: number;
	offset?: number;
};

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
 *
 * These are exactly the six spellings in `banquet_event_orders_beo_status_check`.
 * Until slice 3 of ui-gaps/13-sales-catering.md this enum read `PENDING` and
 * `CONFIRMED` where the table says `PENDING_APPROVAL` and `APPROVED` — drift
 * that stayed invisible because nothing referenced the enum (`beo_status` on the
 * list item was the untyped `z.string()`, and the GET route spelled the filter
 * values out by hand). The first write to reach for it would have been rejected
 * by the CHECK at runtime. Same class as the 2026-08-13 case-drift sweep.
 */
export const BeoStatusEnum = z.enum([
	"DRAFT",
	"PENDING_APPROVAL",
	"APPROVED",
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
	beo_status: BeoStatusEnum,
	beo_status_display: z.string(),
	/**
	 * True when a later revision points back at this row via `previous_beo_id`.
	 * Derived in SQL rather than stored: the status CHECK has no `SUPERSEDED`
	 * value, and the revision chain already carries the fact.
	 */
	is_superseded: z.boolean(),
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

/**
 * Banquet Event Order detail schema.
 * Used by: GET /v1/banquet-orders/:beoId and every write route's response.
 *
 * The list item carries what a BEO index row needs. The BEO *is* the operational
 * document, though — the kitchen, the setup crew and the captain all work from
 * it — so the detail adds the parts they actually read: the full timeline, the
 * F&B blocks, dietary counts, décor, equipment, staffing, instructions and the
 * approval and execution state. UI items 3 (BEO editor) and 5 (daily BEO print)
 * both read from here.
 *
 * `DECIMAL` and `TIME` columns arrive as strings because the query casts them
 * `::TEXT`, matching the list item's existing money fields; timestamps are
 * ISO strings via the service's `toIsoString`.
 */
export const BanquetOrderDetailSchema = BanquetOrderListItemSchema.extend({
	// Revision tracking — the reason this domain is versioned at all
	revision_date: z.string().optional(),
	revision_reason: z.string().optional(),
	previous_beo_id: uuid.optional(),

	// Timeline
	setup_start_time: z.string(),
	teardown_end_time: z.string().optional(),
	room_release_time: z.string().optional(),

	// Room and setup
	tables_count: z.number().int().optional(),
	chairs_count: z.number().int().optional(),
	table_configuration: z.string().optional(),
	seating_chart_layout_url: z.string().optional(),
	over_set_percentage: z.string().optional(),

	// Menu and food service
	menu_items: z.unknown().optional(),
	courses_count: z.number().int().optional(),
	meal_service_start_time: z.string().optional(),
	meal_service_duration_minutes: z.number().int().optional(),
	appetizers: z.unknown().optional(),
	salads: z.unknown().optional(),
	entrees: z.unknown().optional(),
	sides: z.unknown().optional(),
	desserts: z.unknown().optional(),
	stations: z.unknown().optional(),

	// Beverage service
	bar_start_time: z.string().optional(),
	bar_end_time: z.string().optional(),
	bar_setup_location: z.string().optional(),
	beverages: z.unknown().optional(),
	wine_service: z.unknown().optional(),
	coffee_tea_service: z.boolean().optional(),
	water_service: z.string().optional(),

	// Dietary restrictions — what the kitchen plates separately
	vegetarian_count: z.number().int().optional(),
	vegan_count: z.number().int().optional(),
	gluten_free_count: z.number().int().optional(),
	dairy_free_count: z.number().int().optional(),
	nut_free_count: z.number().int().optional(),
	kosher_count: z.number().int().optional(),
	halal_count: z.number().int().optional(),
	special_diets: z.unknown().optional(),

	// Linens and décor
	linen_color: z.string().optional(),
	linen_type: z.string().optional(),
	napkin_color: z.string().optional(),
	napkin_fold: z.string().optional(),
	table_skirting: z.boolean().optional(),
	centerpieces: z.string().optional(),
	decor_description: z.string().optional(),
	candles: z.boolean().optional(),
	floral_arrangements: z.string().optional(),

	// Equipment and AV
	equipment_list: z.unknown().optional(),
	av_equipment: z.unknown().optional(),
	stage_required: z.boolean().optional(),
	stage_dimensions: z.string().optional(),
	podium_required: z.boolean().optional(),
	dance_floor_required: z.boolean().optional(),
	special_lighting: z.boolean().optional(),
	lighting_notes: z.string().optional(),

	// Service staff
	servers_count: z.number().int().optional(),
	bartenders_count: z.number().int().optional(),
	chefs_count: z.number().int().optional(),
	captains_count: z.number().int().optional(),
	coat_check_attendants: z.number().int().optional(),
	valet_attendants: z.number().int().optional(),
	security_guards: z.number().int().optional(),
	staff_arrival_time: z.string().optional(),
	staff_meal_time: z.string().optional(),
	staff_break_schedule: z.string().optional(),
	overtime_authorized: z.boolean().optional(),

	// Financial
	equipment_rental_total: z.string().optional(),
	labor_charges: z.string().optional(),
	service_charge_percent: z.string().optional(),
	service_charge_amount: z.string().optional(),
	gratuity_percent: z.string().optional(),
	gratuity_amount: z.string().optional(),
	tax_percent: z.string().optional(),
	tax_amount: z.string().optional(),
	currency_code: z.string().optional(),
	billing_type: z.string().optional(),
	price_per_person: z.string().optional(),
	children_price: z.string().optional(),
	children_count: z.number().int().optional(),

	// Special instructions — the free text each department works from
	kitchen_instructions: z.string().optional(),
	service_instructions: z.string().optional(),
	setup_instructions: z.string().optional(),
	cleanup_instructions: z.string().optional(),
	audio_visual_instructions: z.string().optional(),

	// Approvals
	client_approved_date: z.string().optional(),
	client_approved_by: z.string().optional(),
	client_signature_url: z.string().optional(),
	chef_approved_date: z.string().optional(),
	chef_approved_by: uuid.optional(),
	manager_approved_date: z.string().optional(),
	manager_approved_by: uuid.optional(),

	// Execution tracking
	setup_completed_time: z.string().optional(),
	event_started_time: z.string().optional(),
	event_ended_time: z.string().optional(),
	teardown_completed: z.boolean().optional(),
	teardown_completed_time: z.string().optional(),

	// Post-event
	post_event_notes: z.string().optional(),
	issues_encountered: z.string().optional(),
	client_satisfaction_rating: z.number().int().optional(),
	photos: z.unknown().optional(),

	// Distribution — stamped by the publish route
	last_sent_to_client: z.string().optional(),
	last_sent_to_kitchen: z.string().optional(),
	last_sent_to_setup: z.string().optional(),
	distribution_list: z.array(z.string()).optional(),

	// Documents
	signed_beo_url: z.string().optional(),
	floor_plan_url: z.string().optional(),
	seating_chart_document_url: z.string().optional(),
	menu_card_url: z.string().optional(),

	// Notes
	internal_notes: z.string().optional(),
	client_notes: z.string().optional(),
	allergy_warnings: z.string().optional(),

	metadata: z.unknown().optional(),
	updated_at: z.string().optional(),
});

export type BanquetOrderDetail = z.infer<typeof BanquetOrderDetailSchema>;

/**
 * Create a banquet event order.
 *
 * Slice 3 of ui-gaps/13-sales-catering.md — plain HTTP on the owning service per
 * COV-18's rule, matching slices 1 and 2.
 *
 * Required fields are exactly the table's NOT NULL columns with no default:
 * `event_booking_id`, `event_date`, `setup_start_time`, `event_start_time`,
 * `event_end_time`, `meeting_room_id`, `room_setup`, `guaranteed_count`.
 * `beo_number` is generated when absent and `beo_status` is not settable here —
 * a BEO is born a DRAFT and moves only through publish and revise, which is what
 * makes "frozen for the kitchen" mean anything.
 *
 * Bounds mirror the table's CHECK constraints so a bad payload is a 400 rather
 * than a 23514: `beo_count_check` (guaranteed_count > 0), `beo_time_check`
 * (event_end_time <> event_start_time) and `beo_rating_check` (rating 1–5).
 * They mirror those and stop there — see {@link refineBeoTimes} for why an
 * apparently obvious setup/teardown ordering rule is wrong on bare TIME columns.
 */
/** `TIME` column input: HH:MM or HH:MM:SS, matching the event booking fields. */
const BEO_TIME_OF_DAY = z
	.string()
	.regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM or HH:MM:SS");

const BEO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const BanquetOrderWriteFieldsSchema = z.object({
	tenant_id: uuid,
	property_id: uuid,

	// Linked event — a BEO is always the operational detail of one booking
	event_booking_id: uuid,
	beo_number: z.string().max(50).optional(),

	// Timeline
	event_date: BEO_DATE,
	setup_start_time: BEO_TIME_OF_DAY,
	event_start_time: BEO_TIME_OF_DAY,
	event_end_time: BEO_TIME_OF_DAY,
	teardown_end_time: BEO_TIME_OF_DAY.optional(),
	room_release_time: BEO_TIME_OF_DAY.optional(),

	// Room and setup
	meeting_room_id: uuid,
	room_setup: EventSetupTypeEnum,
	tables_count: z.coerce.number().int().nonnegative().optional(),
	chairs_count: z.coerce.number().int().nonnegative().optional(),
	table_configuration: z.string().optional(),
	seating_chart_layout_url: z.string().max(500).optional(),

	// Counts
	guaranteed_count: z.coerce.number().int().positive(),
	expected_count: z.coerce.number().int().nonnegative().optional(),
	over_set_percentage: z.coerce.number().nonnegative().optional(),
	actual_count: z.coerce.number().int().nonnegative().optional(),

	// Menu and food service
	menu_type: z.string().max(50).optional(),
	menu_items: z.array(z.unknown()).optional(),
	service_style: z.string().max(50).optional(),
	courses_count: z.coerce.number().int().nonnegative().optional(),
	meal_service_start_time: BEO_TIME_OF_DAY.optional(),
	meal_service_duration_minutes: z.coerce.number().int().nonnegative().optional(),
	appetizers: z.array(z.unknown()).optional(),
	salads: z.array(z.unknown()).optional(),
	entrees: z.array(z.unknown()).optional(),
	sides: z.array(z.unknown()).optional(),
	desserts: z.array(z.unknown()).optional(),
	stations: z.array(z.unknown()).optional(),

	// Beverage service
	bar_type: z.string().max(50).optional(),
	bar_start_time: BEO_TIME_OF_DAY.optional(),
	bar_end_time: BEO_TIME_OF_DAY.optional(),
	bar_setup_location: z.string().max(100).optional(),
	beverages: z.array(z.unknown()).optional(),
	wine_service: z.record(z.unknown()).optional(),
	coffee_tea_service: z.boolean().optional(),
	water_service: z.string().max(50).optional(),

	// Dietary restrictions
	vegetarian_count: z.coerce.number().int().nonnegative().optional(),
	vegan_count: z.coerce.number().int().nonnegative().optional(),
	gluten_free_count: z.coerce.number().int().nonnegative().optional(),
	dairy_free_count: z.coerce.number().int().nonnegative().optional(),
	nut_free_count: z.coerce.number().int().nonnegative().optional(),
	kosher_count: z.coerce.number().int().nonnegative().optional(),
	halal_count: z.coerce.number().int().nonnegative().optional(),
	special_diets: z.array(z.unknown()).optional(),

	// Linens and décor
	linen_color: z.string().max(50).optional(),
	linen_type: z.string().max(50).optional(),
	napkin_color: z.string().max(50).optional(),
	napkin_fold: z.string().max(50).optional(),
	table_skirting: z.boolean().optional(),
	centerpieces: z.string().optional(),
	decor_description: z.string().optional(),
	candles: z.boolean().optional(),
	floral_arrangements: z.string().optional(),

	// Equipment and AV
	equipment_list: z.array(z.unknown()).optional(),
	av_equipment: z.array(z.unknown()).optional(),
	stage_required: z.boolean().optional(),
	stage_dimensions: z.string().max(50).optional(),
	podium_required: z.boolean().optional(),
	dance_floor_required: z.boolean().optional(),
	special_lighting: z.boolean().optional(),
	lighting_notes: z.string().optional(),

	// Service staff
	servers_count: z.coerce.number().int().nonnegative().optional(),
	bartenders_count: z.coerce.number().int().nonnegative().optional(),
	chefs_count: z.coerce.number().int().nonnegative().optional(),
	captains_count: z.coerce.number().int().nonnegative().optional(),
	coat_check_attendants: z.coerce.number().int().nonnegative().optional(),
	valet_attendants: z.coerce.number().int().nonnegative().optional(),
	security_guards: z.coerce.number().int().nonnegative().optional(),
	staff_arrival_time: BEO_TIME_OF_DAY.optional(),
	staff_meal_time: BEO_TIME_OF_DAY.optional(),
	staff_break_schedule: z.string().optional(),
	overtime_authorized: z.boolean().optional(),

	// Financial
	food_subtotal: z.coerce.number().nonnegative().optional(),
	beverage_subtotal: z.coerce.number().nonnegative().optional(),
	equipment_rental_total: z.coerce.number().nonnegative().optional(),
	labor_charges: z.coerce.number().nonnegative().optional(),
	service_charge_percent: z.coerce.number().nonnegative().optional(),
	service_charge_amount: z.coerce.number().nonnegative().optional(),
	gratuity_percent: z.coerce.number().nonnegative().optional(),
	gratuity_amount: z.coerce.number().nonnegative().optional(),
	tax_percent: z.coerce.number().nonnegative().optional(),
	tax_amount: z.coerce.number().nonnegative().optional(),
	total_estimated: z.coerce.number().nonnegative().optional(),
	total_actual: z.coerce.number().nonnegative().optional(),
	currency_code: z.string().length(3).optional(),

	// Billing
	billing_type: z.string().max(50).optional(),
	price_per_person: z.coerce.number().nonnegative().optional(),
	children_price: z.coerce.number().nonnegative().optional(),
	children_count: z.coerce.number().int().nonnegative().optional(),

	// Special instructions
	kitchen_instructions: z.string().optional(),
	service_instructions: z.string().optional(),
	setup_instructions: z.string().optional(),
	cleanup_instructions: z.string().optional(),
	audio_visual_instructions: z.string().optional(),

	// Approvals — the boolean and who gave it; the dates are stamped by the service
	client_approved: z.boolean().optional(),
	client_approved_by: z.string().max(200).optional(),
	client_signature_url: z.string().max(500).optional(),
	chef_approved: z.boolean().optional(),
	chef_approved_by: uuid.optional(),
	manager_approved: z.boolean().optional(),
	manager_approved_by: uuid.optional(),

	// Execution tracking
	setup_completed: z.boolean().optional(),
	event_started: z.boolean().optional(),
	event_ended: z.boolean().optional(),
	teardown_completed: z.boolean().optional(),

	// Post-event
	post_event_notes: z.string().optional(),
	issues_encountered: z.string().optional(),
	client_satisfaction_rating: z.coerce.number().int().min(1).max(5).optional(),
	photos: z.array(z.unknown()).optional(),

	// Distribution and documents
	distribution_list: z.array(z.string()).optional(),
	signed_beo_url: z.string().max(500).optional(),
	floor_plan_url: z.string().max(500).optional(),
	seating_chart_document_url: z.string().max(500).optional(),
	menu_card_url: z.string().max(500).optional(),

	// Notes
	internal_notes: z.string().optional(),
	client_notes: z.string().optional(),
	allergy_warnings: z.string().optional(),

	metadata: z.record(z.unknown()).optional(),
});

/**
 * `event_end_time <> event_start_time`, mirroring the relaxed `beo_time_check`.
 *
 * Setup and teardown are deliberately not ordered against the event window, and
 * the event window is no longer ordered against itself either. Both follow from
 * the day-boundary convention on {@link eventEndsNextDay}: a teardown at 01:00
 * after a 23:30 finish is the small hours of the next morning, not thirteen
 * hours early, and an end at or before the start is the next day. Requiring the
 * ordering rejected the single most ordinary banquet there is — an evening
 * function cleared down after midnight — which is how the over-reach was found:
 * the first realistic wedding payload bounced with a 400.
 *
 * What is left is the one thing no convention can rescue: a zero-length event.
 */
const refineBeoTimes = <T extends z.ZodTypeAny>(schema: T) =>
	schema.refine(
		(value: { event_start_time?: string; event_end_time?: string }) =>
			!value.event_start_time ||
			!value.event_end_time ||
			padTimeOfDay(value.event_end_time) !==
				padTimeOfDay(value.event_start_time),
		{
			message: "event_end_time must differ from event_start_time",
			path: ["event_end_time"],
		},
	);

export const BanquetOrderWriteBodySchema = refineBeoTimes(
	BanquetOrderWriteFieldsSchema,
);

export type BanquetOrderWriteBody = z.infer<typeof BanquetOrderWriteBodySchema>;

/**
 * Edit a banquet event order. Every field optional but `tenant_id`.
 *
 * Only accepted while the BEO is still a draft — see {@link BEO_EDITABLE_STATUSES}.
 *
 * `property_id` and `event_booking_id` are omitted rather than optional: a BEO is
 * the operational detail *of one booking at one property*, so re-pointing it at a
 * different event would silently rewrite what the kitchen is cooking for. Move
 * the booking, or write a new BEO.
 */
export const BanquetOrderUpdateBodySchema = refineBeoTimes(
	BanquetOrderWriteFieldsSchema.partial()
		.omit({ tenant_id: true, property_id: true, event_booking_id: true })
		.extend({ tenant_id: uuid }),
);

export type BanquetOrderUpdateBody = z.infer<
	typeof BanquetOrderUpdateBodySchema
>;

/**
 * Publish a BEO — freeze it for the kitchen and the setup crew.
 *
 * Publishing is what gives a BEO its authority: once it is out, the departments
 * are working from paper on a wall and an in-place edit would silently diverge
 * from what they hold. So publishing closes the document to further edits and
 * every later change has to go through {@link BanquetOrderReviseBodySchema},
 * which produces a new numbered version the kitchen can see it does not have.
 *
 * `distribution_list` overrides the stored list for this send when supplied.
 */
export const BanquetOrderPublishBodySchema = z.object({
	tenant_id: uuid,
	distribution_list: z.array(z.string()).optional(),
	/** Marks `last_sent_to_client` too, for a client-facing send. */
	notify_client: z.boolean().optional(),
});

export type BanquetOrderPublishBody = z.infer<
	typeof BanquetOrderPublishBodySchema
>;

/**
 * Revise a published BEO — the versioning that BEOs exist for.
 *
 * A revision is a *new row*, not an edit: same `beo_number`, `beo_version + 1`,
 * `previous_beo_id` pointing at the row it replaces. The old row is left exactly
 * as the kitchen received it, which is the whole point — "what changed between
 * v2 and v3" is a question the operation asks constantly. The table's
 * `UNIQUE (tenant_id, property_id, beo_number, beo_version)` is what lets both
 * versions coexist under one number.
 *
 * The new version starts as a DRAFT, so a revision is edited and then published
 * in its own right.
 */
export const BanquetOrderReviseBodySchema = z.object({
	tenant_id: uuid,
	revision_reason: z.string().min(1).max(1000),
});

export type BanquetOrderReviseBody = z.infer<
	typeof BanquetOrderReviseBodySchema
>;

/**
 * The statuses in which a BEO can still be edited in place.
 *
 * Anything past this is frozen and must be revised instead. Exported so the BEO
 * editor can disable its own form rather than let the user type into a document
 * the service will refuse — the same reasoning as
 * {@link EVENT_BOOKING_LEGAL_TRANSITIONS}.
 */
export const BEO_EDITABLE_STATUSES: readonly BeoStatus[] = [
	"DRAFT",
	"PENDING_APPROVAL",
];

/**
 * The statuses a BEO can be published from.
 *
 * Publishing an already-published BEO is a conflict rather than a no-op: the
 * caller believes it is releasing something the kitchen has not seen, and it is
 * not. Re-issuing means revising.
 */
export const BEO_PUBLISHABLE_STATUSES: readonly BeoStatus[] = [
	"DRAFT",
	"PENDING_APPROVAL",
];

/** Service-layer input for a banquet event order write, per AGENTS.md. */
export type BanquetOrderWriteInput = {
	propertyId?: string;
	eventBookingId?: string;
	beoNumber?: string;
	eventDate?: string;
	setupStartTime?: string;
	eventStartTime?: string;
	eventEndTime?: string;
	teardownEndTime?: string;
	roomReleaseTime?: string;
	meetingRoomId?: string;
	roomSetup?: EventSetupType;
	tablesCount?: number;
	chairsCount?: number;
	tableConfiguration?: string;
	seatingChartLayoutUrl?: string;
	guaranteedCount?: number;
	expectedCount?: number;
	overSetPercentage?: number;
	actualCount?: number;
	menuType?: string;
	menuItems?: unknown;
	serviceStyle?: string;
	coursesCount?: number;
	mealServiceStartTime?: string;
	mealServiceDurationMinutes?: number;
	appetizers?: unknown;
	salads?: unknown;
	entrees?: unknown;
	sides?: unknown;
	desserts?: unknown;
	stations?: unknown;
	barType?: string;
	barStartTime?: string;
	barEndTime?: string;
	barSetupLocation?: string;
	beverages?: unknown;
	wineService?: unknown;
	coffeeTeaService?: boolean;
	waterService?: string;
	vegetarianCount?: number;
	veganCount?: number;
	glutenFreeCount?: number;
	dairyFreeCount?: number;
	nutFreeCount?: number;
	kosherCount?: number;
	halalCount?: number;
	specialDiets?: unknown;
	linenColor?: string;
	linenType?: string;
	napkinColor?: string;
	napkinFold?: string;
	tableSkirting?: boolean;
	centerpieces?: string;
	decorDescription?: string;
	candles?: boolean;
	floralArrangements?: string;
	equipmentList?: unknown;
	avEquipment?: unknown;
	stageRequired?: boolean;
	stageDimensions?: string;
	podiumRequired?: boolean;
	danceFloorRequired?: boolean;
	specialLighting?: boolean;
	lightingNotes?: string;
	serversCount?: number;
	bartendersCount?: number;
	chefsCount?: number;
	captainsCount?: number;
	coatCheckAttendants?: number;
	valetAttendants?: number;
	securityGuards?: number;
	staffArrivalTime?: string;
	staffMealTime?: string;
	staffBreakSchedule?: string;
	overtimeAuthorized?: boolean;
	foodSubtotal?: number;
	beverageSubtotal?: number;
	equipmentRentalTotal?: number;
	laborCharges?: number;
	serviceChargePercent?: number;
	serviceChargeAmount?: number;
	gratuityPercent?: number;
	gratuityAmount?: number;
	taxPercent?: number;
	taxAmount?: number;
	totalEstimated?: number;
	totalActual?: number;
	currencyCode?: string;
	billingType?: string;
	pricePerPerson?: number;
	childrenPrice?: number;
	childrenCount?: number;
	kitchenInstructions?: string;
	serviceInstructions?: string;
	setupInstructions?: string;
	cleanupInstructions?: string;
	audioVisualInstructions?: string;
	clientApproved?: boolean;
	clientApprovedBy?: string;
	clientSignatureUrl?: string;
	chefApproved?: boolean;
	chefApprovedBy?: string;
	managerApproved?: boolean;
	managerApprovedBy?: string;
	setupCompleted?: boolean;
	eventStarted?: boolean;
	eventEnded?: boolean;
	teardownCompleted?: boolean;
	postEventNotes?: string;
	issuesEncountered?: string;
	clientSatisfactionRating?: number;
	photos?: unknown;
	distributionList?: string[];
	signedBeoUrl?: string;
	floorPlanUrl?: string;
	seatingChartDocumentUrl?: string;
	menuCardUrl?: string;
	internalNotes?: string;
	clientNotes?: string;
	allergyWarnings?: string;
	metadata?: unknown;
};

/** Service-layer input for publishing a BEO. */
export type BanquetOrderPublishInput = {
	distributionList?: string[];
	notifyClient?: boolean;
};

/** Service-layer input for revising a BEO. */
export type BanquetOrderReviseInput = {
	revisionReason: string;
};

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
