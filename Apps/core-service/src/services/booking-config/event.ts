import {
  EVENT_BOOKING_LEGAL_TRANSITIONS,
  type EventBookingDetail,
  type EventBookingDetailRow,
  EventBookingDetailSchema,
  type EventBookingListItem,
  EventBookingListItemSchema,
  type EventBookingRow,
  type EventBookingStatus,
  type EventBookingWriteInput,
  type GetEventBookingInput,
  type GetMeetingRoomInput,
  type ListEventBookingsInput,
  type ListMeetingRoomsInput,
  type MeetingRoomListItem,
  MeetingRoomListItemSchema,
  type MeetingRoomRow,
  type MeetingRoomWriteInput,
  resolveEventOccupancyWindow,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import {
  EVENT_BOOKING_BY_ID_SQL,
  EVENT_BOOKING_LIST_SQL,
  MEETING_ROOM_BY_ID_SQL,
  MEETING_ROOM_LIST_SQL,
} from "../../sql/booking-config/event.js";

import { formatDisplayLabel, toIsoString, toNumber } from "./common.js";

// =====================================================
// MEETING ROOM SERVICE
// =====================================================

const mapMeetingRoomRow = (row: MeetingRoomRow): MeetingRoomListItem => {
  return MeetingRoomListItemSchema.parse({
    room_id: row.room_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    room_code: row.room_code,
    room_name: row.room_name,
    room_type: row.room_type?.toUpperCase() ?? "MEETING",
    room_type_display: formatDisplayLabel(row.room_type),
    room_status: row.room_status?.toUpperCase() ?? "AVAILABLE",
    room_status_display: formatDisplayLabel(row.room_status),
    building: row.building,
    floor: row.floor,
    location_description: row.location_description,
    max_capacity: row.max_capacity ?? 0,
    theater_capacity: row.theater_capacity,
    classroom_capacity: row.classroom_capacity,
    banquet_capacity: row.banquet_capacity,
    reception_capacity: row.reception_capacity,
    u_shape_capacity: row.u_shape_capacity,
    boardroom_capacity: row.boardroom_capacity,
    area_sqm: toNumber(row.area_sqm),
    area_sqft: toNumber(row.area_sqft),
    length_meters: toNumber(row.length_meters),
    width_meters: toNumber(row.width_meters),
    ceiling_height_meters: toNumber(row.ceiling_height_meters),
    has_natural_light: Boolean(row.has_natural_light),
    has_audio_visual: Boolean(row.has_audio_visual),
    has_video_conferencing: Boolean(row.has_video_conferencing),
    has_wifi: Boolean(row.has_wifi),
    has_stage: Boolean(row.has_stage),
    has_dance_floor: Boolean(row.has_dance_floor),
    wheelchair_accessible: Boolean(row.wheelchair_accessible),
    default_setup: row.default_setup,
    setup_time_minutes: row.setup_time_minutes ?? 60,
    teardown_time_minutes: row.teardown_time_minutes ?? 60,
    turnover_time_minutes: row.turnover_time_minutes ?? 30,
    hourly_rate: toNumber(row.hourly_rate),
    half_day_rate: toNumber(row.half_day_rate),
    full_day_rate: toNumber(row.full_day_rate),
    minimum_rental_hours: row.minimum_rental_hours ?? 1,
    currency_code: row.currency_code ?? "USD",
    operating_hours_start: row.operating_hours_start,
    operating_hours_end: row.operating_hours_end,
    catering_required: Boolean(row.catering_required),
    in_house_catering_available: Boolean(row.in_house_catering_available),
    external_catering_allowed: Boolean(row.external_catering_allowed),
    primary_photo_url: row.primary_photo_url,
    floor_plan_url: row.floor_plan_url,
    virtual_tour_url: row.virtual_tour_url,
    is_active: Boolean(row.is_active),
    requires_approval: Boolean(row.requires_approval),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export const listMeetingRooms = async (
  options: ListMeetingRoomsInput,
): Promise<MeetingRoomListItem[]> => {
  const { rows } = await query<MeetingRoomRow>(MEETING_ROOM_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.roomType ?? null,
    options.roomStatus ?? null,
    options.isActive ?? null,
    options.minCapacity ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapMeetingRoomRow);
};

export const getMeetingRoomById = async (
  options: GetMeetingRoomInput,
): Promise<MeetingRoomListItem | null> => {
  const { rows } = await query<MeetingRoomRow>(MEETING_ROOM_BY_ID_SQL, [
    options.roomId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapMeetingRoomRow(row);
};

// =====================================================
// MEETING ROOM WRITES
//
// Reference data — plain HTTP on the owning service per
// ui-gaps/18-write-path-gap.md. See ui-gaps/13-sales-catering.md.
// =====================================================

/** Raised when (tenant, property, room_code) collides. Routes turn it into a 409. */
export class MeetingRoomCodeConflictError extends Error {
  constructor(roomCode: string) {
    super(`Room code "${roomCode}" already exists for this property`);
    this.name = "MeetingRoomCodeConflictError";
  }
}

const UNIQUE_VIOLATION = "23505";

/** The UNIQUE (tenant_id, property_id, room_code) index — note it is not named after the column. */
const ROOM_CODE_CONSTRAINT = "meeting_rooms_code_unique";

const isRoomCodeConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === UNIQUE_VIOLATION &&
  (error as { constraint?: string }).constraint === ROOM_CODE_CONSTRAINT;

export const createMeetingRoom = async (
  tenantId: string,
  input: MeetingRoomWriteInput,
  actorId?: string,
): Promise<MeetingRoomListItem | null> => {
  let roomId: string | undefined;

  try {
    const { rows } = await query<{ room_id: string }>(
      `
        INSERT INTO public.meeting_rooms (
          tenant_id, property_id,
          room_code, room_name, room_type, room_status, max_capacity,
          building, floor, location_description,
          theater_capacity, classroom_capacity, banquet_capacity,
          reception_capacity, u_shape_capacity, boardroom_capacity,
          area_sqm, area_sqft, length_meters, width_meters, ceiling_height_meters,
          has_natural_light, has_audio_visual, has_video_conferencing, has_wifi,
          has_stage, has_dance_floor, wheelchair_accessible,
          default_setup, setup_time_minutes, teardown_time_minutes, turnover_time_minutes,
          hourly_rate, half_day_rate, full_day_rate, minimum_rental_hours, currency_code,
          operating_hours_start, operating_hours_end,
          catering_required, in_house_catering_available, external_catering_allowed,
          primary_photo_url, floor_plan_url, virtual_tour_url,
          is_active, requires_approval,
          created_by, updated_by
        ) VALUES (
          $1::uuid, $2::uuid,
          $3, $4, $5, COALESCE($6, 'AVAILABLE'), $7,
          $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20, $21,
          COALESCE($22, false), COALESCE($23, false), COALESCE($24, false), COALESCE($25, false),
          COALESCE($26, false), COALESCE($27, false), COALESCE($28, false),
          $29, COALESCE($30, 0), COALESCE($31, 0), COALESCE($32, 0),
          $33, $34, $35, COALESCE($36, 0), COALESCE($37, 'USD'),
          $38::time, $39::time,
          COALESCE($40, false), COALESCE($41, false), COALESCE($42, false),
          $43, $44, $45,
          COALESCE($46, true), COALESCE($47, false),
          $48, $48
        )
        RETURNING room_id
      `,
      [
        tenantId,
        input.propertyId ?? null,
        input.roomCode,
        input.roomName,
        input.roomType,
        input.roomStatus ?? null,
        input.maxCapacity,
        input.building ?? null,
        input.floor ?? null,
        input.locationDescription ?? null,
        input.theaterCapacity ?? null,
        input.classroomCapacity ?? null,
        input.banquetCapacity ?? null,
        input.receptionCapacity ?? null,
        input.uShapeCapacity ?? null,
        input.boardroomCapacity ?? null,
        input.areaSqm ?? null,
        input.areaSqft ?? null,
        input.lengthMeters ?? null,
        input.widthMeters ?? null,
        input.ceilingHeightMeters ?? null,
        input.hasNaturalLight ?? null,
        input.hasAudioVisual ?? null,
        input.hasVideoConferencing ?? null,
        input.hasWifi ?? null,
        input.hasStage ?? null,
        input.hasDanceFloor ?? null,
        input.wheelchairAccessible ?? null,
        input.defaultSetup ?? null,
        input.setupTimeMinutes ?? null,
        input.teardownTimeMinutes ?? null,
        input.turnoverTimeMinutes ?? null,
        input.hourlyRate ?? null,
        input.halfDayRate ?? null,
        input.fullDayRate ?? null,
        input.minimumRentalHours ?? null,
        input.currencyCode ?? null,
        input.operatingHoursStart ?? null,
        input.operatingHoursEnd ?? null,
        input.cateringRequired ?? null,
        input.inHouseCateringAvailable ?? null,
        input.externalCateringAllowed ?? null,
        input.primaryPhotoUrl ?? null,
        input.floorPlanUrl ?? null,
        input.virtualTourUrl ?? null,
        input.isActive ?? null,
        input.requiresApproval ?? null,
        actorId ?? null,
      ],
    );
    roomId = rows[0]?.room_id;
  } catch (error) {
    if (isRoomCodeConflict(error)) {
      throw new MeetingRoomCodeConflictError(input.roomCode ?? "");
    }
    throw error;
  }

  if (!roomId) return null;

  return getMeetingRoomById({ roomId, tenantId });
};

export const updateMeetingRoom = async (
  tenantId: string,
  roomId: string,
  input: MeetingRoomWriteInput,
  actorId?: string,
): Promise<MeetingRoomListItem | null> => {
  let rowCount: number | null = null;

  try {
    const result = await query(
      `
        UPDATE public.meeting_rooms
        SET
          room_code = COALESCE($3, room_code),
          room_name = COALESCE($4, room_name),
          room_type = COALESCE($5, room_type),
          room_status = COALESCE($6, room_status),
          max_capacity = COALESCE($7, max_capacity),
          building = COALESCE($8, building),
          floor = COALESCE($9, floor),
          location_description = COALESCE($10, location_description),
          theater_capacity = COALESCE($11, theater_capacity),
          classroom_capacity = COALESCE($12, classroom_capacity),
          banquet_capacity = COALESCE($13, banquet_capacity),
          reception_capacity = COALESCE($14, reception_capacity),
          u_shape_capacity = COALESCE($15, u_shape_capacity),
          boardroom_capacity = COALESCE($16, boardroom_capacity),
          area_sqm = COALESCE($17, area_sqm),
          area_sqft = COALESCE($18, area_sqft),
          length_meters = COALESCE($19, length_meters),
          width_meters = COALESCE($20, width_meters),
          ceiling_height_meters = COALESCE($21, ceiling_height_meters),
          has_natural_light = COALESCE($22, has_natural_light),
          has_audio_visual = COALESCE($23, has_audio_visual),
          has_video_conferencing = COALESCE($24, has_video_conferencing),
          has_wifi = COALESCE($25, has_wifi),
          has_stage = COALESCE($26, has_stage),
          has_dance_floor = COALESCE($27, has_dance_floor),
          wheelchair_accessible = COALESCE($28, wheelchair_accessible),
          default_setup = COALESCE($29, default_setup),
          setup_time_minutes = COALESCE($30, setup_time_minutes),
          teardown_time_minutes = COALESCE($31, teardown_time_minutes),
          turnover_time_minutes = COALESCE($32, turnover_time_minutes),
          hourly_rate = COALESCE($33, hourly_rate),
          half_day_rate = COALESCE($34, half_day_rate),
          full_day_rate = COALESCE($35, full_day_rate),
          minimum_rental_hours = COALESCE($36, minimum_rental_hours),
          currency_code = COALESCE($37, currency_code),
          operating_hours_start = COALESCE($38::time, operating_hours_start),
          operating_hours_end = COALESCE($39::time, operating_hours_end),
          catering_required = COALESCE($40, catering_required),
          in_house_catering_available = COALESCE($41, in_house_catering_available),
          external_catering_allowed = COALESCE($42, external_catering_allowed),
          primary_photo_url = COALESCE($43, primary_photo_url),
          floor_plan_url = COALESCE($44, floor_plan_url),
          virtual_tour_url = COALESCE($45, virtual_tour_url),
          is_active = COALESCE($46, is_active),
          requires_approval = COALESCE($47, requires_approval),
          updated_by = $48,
          updated_at = CURRENT_TIMESTAMP
        WHERE room_id = $1::uuid AND tenant_id = $2::uuid
          AND COALESCE(is_deleted, false) = false
      `,
      [
        roomId,
        tenantId,
        input.roomCode ?? null,
        input.roomName ?? null,
        input.roomType ?? null,
        input.roomStatus ?? null,
        input.maxCapacity ?? null,
        input.building ?? null,
        input.floor ?? null,
        input.locationDescription ?? null,
        input.theaterCapacity ?? null,
        input.classroomCapacity ?? null,
        input.banquetCapacity ?? null,
        input.receptionCapacity ?? null,
        input.uShapeCapacity ?? null,
        input.boardroomCapacity ?? null,
        input.areaSqm ?? null,
        input.areaSqft ?? null,
        input.lengthMeters ?? null,
        input.widthMeters ?? null,
        input.ceilingHeightMeters ?? null,
        input.hasNaturalLight ?? null,
        input.hasAudioVisual ?? null,
        input.hasVideoConferencing ?? null,
        input.hasWifi ?? null,
        input.hasStage ?? null,
        input.hasDanceFloor ?? null,
        input.wheelchairAccessible ?? null,
        input.defaultSetup ?? null,
        input.setupTimeMinutes ?? null,
        input.teardownTimeMinutes ?? null,
        input.turnoverTimeMinutes ?? null,
        input.hourlyRate ?? null,
        input.halfDayRate ?? null,
        input.fullDayRate ?? null,
        input.minimumRentalHours ?? null,
        input.currencyCode ?? null,
        input.operatingHoursStart ?? null,
        input.operatingHoursEnd ?? null,
        input.cateringRequired ?? null,
        input.inHouseCateringAvailable ?? null,
        input.externalCateringAllowed ?? null,
        input.primaryPhotoUrl ?? null,
        input.floorPlanUrl ?? null,
        input.virtualTourUrl ?? null,
        input.isActive ?? null,
        input.requiresApproval ?? null,
        actorId ?? null,
      ],
    );
    rowCount = result.rowCount;
  } catch (error) {
    if (isRoomCodeConflict(error)) {
      throw new MeetingRoomCodeConflictError(input.roomCode ?? "");
    }
    throw error;
  }

  if (!rowCount) return null;

  return getMeetingRoomById({ roomId, tenantId });
};

/**
 * Retire a meeting room. Soft delete: `event_bookings` and `banquet_event_orders`
 * both reference `room_id` with ON DELETE RESTRICT, so a hard delete would fail
 * the moment the room has any history. Retiring also drops it from the bookable
 * list, which is what the caller actually wants.
 */
export const deleteMeetingRoom = async (
  tenantId: string,
  roomId: string,
  actorId?: string,
): Promise<boolean> => {
  const { rowCount } = await query(
    `
      UPDATE public.meeting_rooms
      SET
        is_deleted = true,
        is_active = false,
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = $3,
        updated_by = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE room_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [roomId, tenantId, actorId ?? null],
  );

  return Boolean(rowCount);
};

// =====================================================
// EVENT BOOKING SERVICE
// =====================================================

// =====================================================

const mapEventBookingRow = (row: EventBookingRow): EventBookingListItem => {
  return EventBookingListItemSchema.parse({
    event_id: row.event_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    event_number: row.event_number,
    event_name: row.event_name,
    event_type: row.event_type?.toUpperCase() ?? "MEETING",
    event_type_display: formatDisplayLabel(row.event_type),
    meeting_room_id: row.meeting_room_id,
    meeting_room_name: row.meeting_room_name ?? undefined,
    event_date: (toIsoString(row.event_date) ?? "").split("T")[0],
    start_time: row.start_time,
    end_time: row.end_time,
    setup_start_time: row.setup_start_time,
    actual_start_time: row.actual_start_time,
    actual_end_time: row.actual_end_time,
    organizer_name: row.organizer_name,
    organizer_company: row.organizer_company,
    organizer_email: row.organizer_email,
    organizer_phone: row.organizer_phone,
    guest_id: row.guest_id ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    company_id: row.company_id ?? undefined,
    expected_attendees: row.expected_attendees ?? 0,
    confirmed_attendees: row.confirmed_attendees,
    actual_attendees: row.actual_attendees,
    guarantee_number: row.guarantee_number,
    setup_type: row.setup_type?.toUpperCase() ?? "THEATER",
    setup_type_display: formatDisplayLabel(row.setup_type),
    catering_required: Boolean(row.catering_required),
    audio_visual_needed: Boolean(row.audio_visual_needed),
    booking_status: row.booking_status?.toUpperCase() ?? "TENTATIVE",
    booking_status_display: formatDisplayLabel(row.booking_status),
    payment_status: row.payment_status?.toUpperCase() ?? "PENDING",
    payment_status_display: formatDisplayLabel(row.payment_status),
    booked_date: (toIsoString(row.booked_date) ?? "").split("T")[0],
    confirmed_date: row.confirmed_date
      ? (toIsoString(row.confirmed_date) ?? "").split("T")[0]
      : null,
    beo_due_date: row.beo_due_date ? (toIsoString(row.beo_due_date) ?? "").split("T")[0] : null,
    final_count_due_date: row.final_count_due_date
      ? (toIsoString(row.final_count_due_date) ?? "").split("T")[0]
      : null,
    rental_rate: toNumber(row.rental_rate),
    estimated_total: toNumber(row.estimated_total),
    actual_total: toNumber(row.actual_total),
    deposit_required: toNumber(row.deposit_required),
    deposit_paid: toNumber(row.deposit_paid),
    currency_code: row.currency_code ?? "USD",
    contract_signed: Boolean(row.contract_signed),
    beo_pdf_url: row.beo_pdf_url,
    post_event_rating: row.post_event_rating,
    attendee_satisfaction_score: toNumber(row.attendee_satisfaction_score),
    is_recurring: Boolean(row.is_recurring),
    followup_required: Boolean(row.followup_required),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

/**
 * The by-id query selects more columns than the list one, and the list mapper
 * would silently drop them — zod strips unknown keys. The detail screen needs
 * exactly those extras, so it gets its own mapper over the same base.
 */
const mapEventBookingDetailRow = (row: EventBookingDetailRow): EventBookingDetail => {
  return EventBookingDetailSchema.parse({
    ...mapEventBookingRow(row),
    teardown_end_time: row.teardown_end_time,
    contact_person: row.contact_person,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    group_booking_id: row.group_booking_id,
    folio_id: row.folio_id,
    setup_details: row.setup_details,
    special_requests: row.special_requests,
    internal_notes: row.internal_notes,
    billing_instructions: row.billing_instructions,
    billing_contact_name: row.billing_contact_name,
    billing_contact_email: row.billing_contact_email,
    // `toIsoString` returns undefined for a null column, and the schema wants an
    // explicit null — an uncancelled booking is a known absence, not a missing field.
    cancellation_date: toIsoString(row.cancellation_date) ?? null,
    cancellation_notes: row.cancellation_notes,
  });
};

export const listEventBookings = async (
  options: ListEventBookingsInput,
): Promise<EventBookingListItem[]> => {
  const { rows } = await query<EventBookingRow>(EVENT_BOOKING_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.eventType ?? null,
    options.bookingStatus ?? null,
    options.eventDateFrom ?? null,
    options.eventDateTo ?? null,
    options.meetingRoomId ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapEventBookingRow);
};

export const getEventBookingById = async (
  options: GetEventBookingInput,
): Promise<EventBookingDetail | null> => {
  const { rows } = await query<EventBookingDetailRow>(EVENT_BOOKING_BY_ID_SQL, [
    options.eventId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapEventBookingDetailRow(row);
};

// =====================================================
// EVENT BOOKING WRITES
// Slice 2 of ui-gaps/13-sales-catering.md. Plain HTTP on the owning service per
// COV-18's rule: one table, one service, no cross-service fan-out.
// =====================================================

/** Raised when the requested space is already held for an overlapping time. */
export class MeetingRoomUnavailableError extends Error {
  constructor(meetingRoomId: string, eventDate: string) {
    super(`Meeting room ${meetingRoomId} is already booked on ${eventDate} for that time range`);
    this.name = "MeetingRoomUnavailableError";
  }
}

/** Raised when a lifecycle transition is not legal from the current status. */
export class EventBookingTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move an event booking from ${from} to ${to}`);
    this.name = "EventBookingTransitionError";
  }
}

/** Raised when the referenced meeting room does not exist for this tenant. */
export class MeetingRoomNotFoundError extends Error {
  constructor(meetingRoomId: string) {
    super(`Meeting room ${meetingRoomId} not found`);
    this.name = "MeetingRoomNotFoundError";
  }
}

/**
 * Statuses that still hold the space. A CANCELLED or NO_SHOW booking releases
 * its room, so it must not block a new one.
 */
const SPACE_HOLDING_STATUSES = [
  "INQUIRY",
  "TENTATIVE",
  "DEFINITE",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
];

// The transition map lives in @tartware/schemas as EVENT_BOOKING_LEGAL_TRANSITIONS:
// the UI needs the same rule to offer only the moves this service will accept,
// and a second copy of it would drift.

/**
 * Function-space double-booking check.
 *
 * `availability-guard-service` guards *guest-room* inventory only — it touches
 * `inventory_locks_shadow` / `inventory_lock_audits` and has no concept of
 * meeting rooms — so it is the wrong mechanism here (checked per COV-13's
 * instruction not to invent a second mechanism without looking).
 *
 * Overlap is half-open: a booking ending at 12:00 does not collide with one
 * starting at 12:00. Setup and teardown windows are included when present, so
 * a room being dressed is not offered to someone else.
 *
 * Compared as resolved instants, not as times on one calendar day. The first
 * cut of this check did the latter and had two faults that only appear once an
 * event may run past midnight: it read a 18:00 → 01:00 window as inverted, and
 * `event_date = $3` hid every collision between neighbouring days — the
 * wedding running to 01:00 and the breakfast setting up at 00:30 never met.
 * Stored rows resolve through the `occupancy_*` generated columns, the proposed
 * booking through `resolveEventOccupancyWindow`; the date range is a three-day
 * prune so `idx_event_bookings_meeting_room` is still usable.
 */
const assertMeetingRoomFree = async (
  tenantId: string,
  meetingRoomId: string,
  eventDate: string,
  startTime: string,
  endTime: string,
  setupStartTime?: string,
  teardownEndTime?: string,
  excludeEventId?: string,
): Promise<void> => {
  const proposed = resolveEventOccupancyWindow(
    eventDate,
    startTime,
    endTime,
    setupStartTime,
    teardownEndTime,
  );

  const { rows } = await query<{ event_id: string }>(
    `
      SELECT event_id
      FROM public.event_bookings
      WHERE tenant_id = $1::uuid
        AND meeting_room_id = $2::uuid
        AND event_date BETWEEN $3::date - 1 AND $3::date + 1
        AND COALESCE(is_deleted, false) = false
        AND booking_status = ANY($4::text[])
        AND ($5::uuid IS NULL OR event_id <> $5::uuid)
        AND occupancy_starts_at < $7::timestamp
        AND occupancy_ends_at > $6::timestamp
      LIMIT 1
    `,
    [
      tenantId,
      meetingRoomId,
      eventDate,
      SPACE_HOLDING_STATUSES,
      excludeEventId ?? null,
      proposed.startsAt,
      proposed.endsAt,
    ],
  );

  if (rows.length > 0) {
    throw new MeetingRoomUnavailableError(meetingRoomId, eventDate);
  }
};

/** Confirms the room exists for this tenant before referencing it. */
const assertMeetingRoomExists = async (tenantId: string, meetingRoomId: string): Promise<void> => {
  const { rows } = await query<{ room_id: string }>(
    `
      SELECT room_id
      FROM public.meeting_rooms
      WHERE room_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `,
    [meetingRoomId, tenantId],
  );

  if (rows.length === 0) {
    throw new MeetingRoomNotFoundError(meetingRoomId);
  }
};

/**
 * The stored hold window for one booking.
 *
 * `EventBookingListItem` omits `teardown_end_time`, so an update that does not
 * restate it would otherwise check availability against a shorter window than
 * the row actually holds. Read it from the table instead.
 */
const getStoredHoldWindow = async (
  tenantId: string,
  eventId: string,
): Promise<{ setupStartTime?: string; teardownEndTime?: string } | null> => {
  const { rows } = await query<{
    setup_start_time: string | null;
    teardown_end_time: string | null;
  }>(
    `
      SELECT setup_start_time, teardown_end_time
      FROM public.event_bookings
      WHERE event_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `,
    [eventId, tenantId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    setupStartTime: row.setup_start_time ?? undefined,
    teardownEndTime: row.teardown_end_time ?? undefined,
  };
};

export const createEventBooking = async (
  tenantId: string,
  input: EventBookingWriteInput,
  actorId?: string,
): Promise<EventBookingDetail | null> => {
  const meetingRoomId = input.meetingRoomId as string;
  const eventDate = input.eventDate as string;
  const startTime = input.startTime as string;
  const endTime = input.endTime as string;

  await assertMeetingRoomExists(tenantId, meetingRoomId);
  await assertMeetingRoomFree(
    tenantId,
    meetingRoomId,
    eventDate,
    startTime,
    endTime,
    input.setupStartTime,
    input.teardownEndTime,
  );

  const { rows } = await query<{ event_id: string }>(
    `
      INSERT INTO public.event_bookings (
        tenant_id, property_id,
        event_number, event_name, event_type,
        meeting_room_id, event_date, start_time, end_time,
        setup_start_time, teardown_end_time,
        organizer_name, organizer_company, organizer_email, organizer_phone,
        contact_person, contact_email, contact_phone,
        guest_id, reservation_id, company_id, group_booking_id,
        expected_attendees, confirmed_attendees, guarantee_number,
        setup_type, setup_details, special_requests,
        catering_required, audio_visual_needed,
        booking_status,
        beo_due_date, final_count_due_date,
        rental_rate, estimated_total, deposit_required, currency_code,
        folio_id, billing_instructions, billing_contact_name, billing_contact_email,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid,
        $3, $4, $5,
        $6::uuid, $7::date, $8::time, $9::time,
        $10::time, $11::time,
        $12, $13, $14, $15,
        $16, $17, $18,
        $19::uuid, $20::uuid, $21::uuid, $22::uuid,
        $23, $24, $25,
        $26, $27, $28,
        COALESCE($29, false), COALESCE($30, false),
        COALESCE($31, 'TENTATIVE'),
        $32::date, $33::date,
        $34, $35, $36, COALESCE($37, 'USD'),
        $38::uuid, $39, $40, $41,
        $42, $42
      )
      RETURNING event_id
    `,
    [
      tenantId,
      input.propertyId ?? null,
      input.eventNumber ?? null,
      input.eventName,
      input.eventType,
      meetingRoomId,
      eventDate,
      startTime,
      endTime,
      input.setupStartTime ?? null,
      input.teardownEndTime ?? null,
      input.organizerName,
      input.organizerCompany ?? null,
      input.organizerEmail ?? null,
      input.organizerPhone ?? null,
      input.contactPerson ?? null,
      input.contactEmail ?? null,
      input.contactPhone ?? null,
      input.guestId ?? null,
      input.reservationId ?? null,
      input.companyId ?? null,
      input.groupBookingId ?? null,
      input.expectedAttendees,
      input.confirmedAttendees ?? null,
      input.guaranteeNumber ?? null,
      input.setupType,
      input.setupDetails ?? null,
      input.specialRequests ?? null,
      input.cateringRequired ?? null,
      input.audioVisualNeeded ?? null,
      input.bookingStatus ?? null,
      input.beoDueDate ?? null,
      input.finalCountDueDate ?? null,
      input.rentalRate ?? null,
      input.estimatedTotal ?? null,
      input.depositRequired ?? null,
      input.currencyCode ?? null,
      input.folioId ?? null,
      input.billingInstructions ?? null,
      input.billingContactName ?? null,
      input.billingContactEmail ?? null,
      actorId ?? null,
    ],
  );

  const eventId = rows[0]?.event_id;
  if (!eventId) return null;

  return getEventBookingById({ eventId, tenantId });
};

export const updateEventBooking = async (
  tenantId: string,
  eventId: string,
  input: EventBookingWriteInput,
  actorId?: string,
): Promise<EventBookingDetail | null> => {
  const existing = await getEventBookingById({ eventId, tenantId });
  if (!existing) return null;

  const meetingRoomId = input.meetingRoomId ?? existing.meeting_room_id;
  const eventDate = input.eventDate ?? existing.event_date;
  const startTime = input.startTime ?? existing.start_time;
  const endTime = input.endTime ?? existing.end_time;

  if (input.meetingRoomId && input.meetingRoomId !== existing.meeting_room_id) {
    await assertMeetingRoomExists(tenantId, input.meetingRoomId);
  }

  // Re-check the space whenever anything that defines the hold moves.
  const holdChanged =
    Boolean(input.meetingRoomId) ||
    Boolean(input.eventDate) ||
    Boolean(input.startTime) ||
    Boolean(input.endTime) ||
    Boolean(input.setupStartTime) ||
    Boolean(input.teardownEndTime);

  if (holdChanged) {
    const stored = await getStoredHoldWindow(tenantId, eventId);
    await assertMeetingRoomFree(
      tenantId,
      meetingRoomId,
      eventDate,
      startTime,
      endTime,
      input.setupStartTime ?? stored?.setupStartTime,
      input.teardownEndTime ?? stored?.teardownEndTime,
      eventId,
    );
  }

  const { rowCount } = await query(
    `
      UPDATE public.event_bookings
      SET
        event_number = COALESCE($3, event_number),
        event_name = COALESCE($4, event_name),
        event_type = COALESCE($5, event_type),
        meeting_room_id = COALESCE($6::uuid, meeting_room_id),
        event_date = COALESCE($7::date, event_date),
        start_time = COALESCE($8::time, start_time),
        end_time = COALESCE($9::time, end_time),
        setup_start_time = COALESCE($10::time, setup_start_time),
        teardown_end_time = COALESCE($11::time, teardown_end_time),
        organizer_name = COALESCE($12, organizer_name),
        organizer_company = COALESCE($13, organizer_company),
        organizer_email = COALESCE($14, organizer_email),
        organizer_phone = COALESCE($15, organizer_phone),
        contact_person = COALESCE($16, contact_person),
        contact_email = COALESCE($17, contact_email),
        contact_phone = COALESCE($18, contact_phone),
        guest_id = COALESCE($19::uuid, guest_id),
        reservation_id = COALESCE($20::uuid, reservation_id),
        company_id = COALESCE($21::uuid, company_id),
        group_booking_id = COALESCE($22::uuid, group_booking_id),
        expected_attendees = COALESCE($23, expected_attendees),
        confirmed_attendees = COALESCE($24, confirmed_attendees),
        guarantee_number = COALESCE($25, guarantee_number),
        setup_type = COALESCE($26, setup_type),
        setup_details = COALESCE($27, setup_details),
        special_requests = COALESCE($28, special_requests),
        catering_required = COALESCE($29, catering_required),
        audio_visual_needed = COALESCE($30, audio_visual_needed),
        beo_due_date = COALESCE($31::date, beo_due_date),
        final_count_due_date = COALESCE($32::date, final_count_due_date),
        rental_rate = COALESCE($33, rental_rate),
        estimated_total = COALESCE($34, estimated_total),
        deposit_required = COALESCE($35, deposit_required),
        currency_code = COALESCE($36, currency_code),
        folio_id = COALESCE($37::uuid, folio_id),
        billing_instructions = COALESCE($38, billing_instructions),
        billing_contact_name = COALESCE($39, billing_contact_name),
        billing_contact_email = COALESCE($40, billing_contact_email),
        updated_by = $41,
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      eventId,
      tenantId,
      input.eventNumber ?? null,
      input.eventName ?? null,
      input.eventType ?? null,
      input.meetingRoomId ?? null,
      input.eventDate ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
      input.setupStartTime ?? null,
      input.teardownEndTime ?? null,
      input.organizerName ?? null,
      input.organizerCompany ?? null,
      input.organizerEmail ?? null,
      input.organizerPhone ?? null,
      input.contactPerson ?? null,
      input.contactEmail ?? null,
      input.contactPhone ?? null,
      input.guestId ?? null,
      input.reservationId ?? null,
      input.companyId ?? null,
      input.groupBookingId ?? null,
      input.expectedAttendees ?? null,
      input.confirmedAttendees ?? null,
      input.guaranteeNumber ?? null,
      input.setupType ?? null,
      input.setupDetails ?? null,
      input.specialRequests ?? null,
      input.cateringRequired ?? null,
      input.audioVisualNeeded ?? null,
      input.beoDueDate ?? null,
      input.finalCountDueDate ?? null,
      input.rentalRate ?? null,
      input.estimatedTotal ?? null,
      input.depositRequired ?? null,
      input.currencyCode ?? null,
      input.folioId ?? null,
      input.billingInstructions ?? null,
      input.billingContactName ?? null,
      input.billingContactEmail ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getEventBookingById({ eventId, tenantId });
};

/**
 * Lifecycle transition. Rejects illegal movements rather than letting any
 * status overwrite any other, and stamps `confirmed_date` / `cancellation_date`
 * so the read model's key dates stay truthful.
 */
export const changeEventBookingStatus = async (
  tenantId: string,
  eventId: string,
  nextStatus: EventBookingStatus,
  cancellationReason?: string,
  actorId?: string,
): Promise<EventBookingDetail | null> => {
  const existing = await getEventBookingById({ eventId, tenantId });
  if (!existing) return null;

  const current = existing.booking_status;
  if (current === nextStatus) {
    return existing;
  }

  if (!EVENT_BOOKING_LEGAL_TRANSITIONS[current]?.includes(nextStatus)) {
    throw new EventBookingTransitionError(current, nextStatus);
  }

  const { rowCount } = await query(
    `
      UPDATE public.event_bookings
      SET
        -- $3 is cast explicitly at every use. Without the casts Postgres deduces
        -- character varying from the assignment and text from the CASE comparisons,
        -- and rejects the whole statement with "inconsistent types deduced for
        -- parameter $3" — a 500 on every lifecycle transition.
        booking_status = $3::text,
        confirmed_date = CASE WHEN $3::text = 'CONFIRMED' THEN CURRENT_DATE ELSE confirmed_date END,
        cancellation_date = CASE WHEN $3::text = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancellation_date END,
        cancellation_notes = COALESCE($4, cancellation_notes),
        updated_by = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [eventId, tenantId, nextStatus, cancellationReason ?? null, actorId ?? null],
  );

  if (!rowCount) return null;

  return getEventBookingById({ eventId, tenantId });
};
