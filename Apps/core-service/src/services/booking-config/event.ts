import {
  type EventBookingListItem,
  EventBookingListItemSchema,
  type MeetingRoomListItem,
  MeetingRoomListItemSchema,
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

type MeetingRoomRow = {
  room_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  room_code: string;
  room_name: string;
  room_type: string;
  room_status: string;
  building: string | null;
  floor: number | null;
  location_description: string | null;
  max_capacity: number;
  theater_capacity: number | null;
  classroom_capacity: number | null;
  banquet_capacity: number | null;
  reception_capacity: number | null;
  u_shape_capacity: number | null;
  boardroom_capacity: number | null;
  area_sqm: number | string | null;
  area_sqft: number | string | null;
  length_meters: number | string | null;
  width_meters: number | string | null;
  ceiling_height_meters: number | string | null;
  has_natural_light: boolean;
  has_audio_visual: boolean;
  has_video_conferencing: boolean;
  has_wifi: boolean;
  has_stage: boolean;
  has_dance_floor: boolean;
  wheelchair_accessible: boolean;
  default_setup: string | null;
  setup_time_minutes: number;
  teardown_time_minutes: number;
  turnover_time_minutes: number;
  hourly_rate: number | string | null;
  half_day_rate: number | string | null;
  full_day_rate: number | string | null;
  minimum_rental_hours: number;
  currency_code: string;
  operating_hours_start: string | null;
  operating_hours_end: string | null;
  catering_required: boolean;
  in_house_catering_available: boolean;
  external_catering_allowed: boolean;
  primary_photo_url: string | null;
  floor_plan_url: string | null;
  virtual_tour_url: string | null;
  is_active: boolean;
  requires_approval: boolean;
  created_at: string | Date;
  updated_at: string | Date | null;
};

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

export type ListMeetingRoomsInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  roomType?: string;
  roomStatus?: string;
  isActive?: boolean;
  minCapacity?: number;
  offset?: number;
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

export type GetMeetingRoomInput = {
  roomId: string;
  tenantId: string;
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
// EVENT BOOKING SERVICE
// =====================================================

type EventBookingRow = {
  event_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  event_number: string | null;
  event_name: string;
  event_type: string;
  meeting_room_id: string;
  meeting_room_name: string | null;
  event_date: string | Date;
  start_time: string;
  end_time: string;
  setup_start_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  organizer_name: string;
  organizer_company: string | null;
  organizer_email: string | null;
  organizer_phone: string | null;
  guest_id: string | null;
  reservation_id: string | null;
  company_id: string | null;
  expected_attendees: number;
  confirmed_attendees: number | null;
  actual_attendees: number | null;
  guarantee_number: number | null;
  setup_type: string;
  catering_required: boolean;
  audio_visual_needed: boolean;
  booking_status: string;
  payment_status: string;
  booked_date: string | Date;
  confirmed_date: string | Date | null;
  beo_due_date: string | Date | null;
  final_count_due_date: string | Date | null;
  rental_rate: number | string | null;
  estimated_total: number | string | null;
  actual_total: number | string | null;
  deposit_required: number | string | null;
  deposit_paid: number | string | null;
  currency_code: string;
  contract_signed: boolean;
  beo_pdf_url: string | null;
  post_event_rating: number | null;
  attendee_satisfaction_score: number | string | null;
  is_recurring: boolean;
  followup_required: boolean;
  created_at: string | Date;
  updated_at: string | Date | null;
};

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

export type ListEventBookingsInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  eventType?: string;
  bookingStatus?: string;
  eventDateFrom?: string;
  eventDateTo?: string;
  meetingRoomId?: string;
  offset?: number;
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

export type GetEventBookingInput = {
  eventId: string;
  tenantId: string;
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
