import {
  type EventBookingListItem,
  EventBookingListItemSchema,
  type EventBookingRow,
  type GetEventBookingInput,
  type GetMeetingRoomInput,
  type ListEventBookingsInput,
  type ListMeetingRoomsInput,
  type MeetingRoomListItem,
  MeetingRoomListItemSchema,
  type MeetingRoomRow,
  type MeetingRoomWriteInput,
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
): Promise<EventBookingListItem | null> => {
  const { rows } = await query<EventBookingRow>(EVENT_BOOKING_BY_ID_SQL, [
    options.eventId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapEventBookingRow(row);
};
