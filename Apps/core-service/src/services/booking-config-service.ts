/**
 * DEV DOC
 * Module: booking-config-service.ts
 * Purpose: Service layer for allotments, booking sources, market segments, and channel mappings
 * Ownership: Core Service
 */

import {
  type AllotmentListItem,
  AllotmentListItemSchema,
  type BookingSourceListItem,
  BookingSourceListItemSchema,
  type ChannelMappingListItem,
  ChannelMappingListItemSchema,
  type CompanyListItem,
  CompanyListItemSchema,
  type EventBookingListItem,
  EventBookingListItemSchema,
  type GroupBookingListItem,
  GroupBookingListItemSchema,
  type MarketSegmentListItem,
  MarketSegmentListItemSchema,
  type MeetingRoomListItem,
  MeetingRoomListItemSchema,
  type PromotionalCodeListItem,
  PromotionalCodeListItemSchema,
  type WaitlistEntryListItem,
  WaitlistEntryListItemSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  ALLOTMENT_BY_ID_SQL,
  ALLOTMENT_LIST_SQL,
  BOOKING_SOURCE_BY_ID_SQL,
  BOOKING_SOURCE_LIST_SQL,
  CHANNEL_MAPPING_BY_ID_SQL,
  CHANNEL_MAPPING_LIST_SQL,
  COMPANY_BY_ID_SQL,
  COMPANY_LIST_SQL,
  EVENT_BOOKING_BY_ID_SQL,
  EVENT_BOOKING_LIST_SQL,
  GROUP_BOOKING_BY_ID_SQL,
  GROUP_BOOKING_LIST_SQL,
  MARKET_SEGMENT_BY_ID_SQL,
  MARKET_SEGMENT_LIST_SQL,
  MEETING_ROOM_BY_ID_SQL,
  MEETING_ROOM_LIST_SQL,
  PROMOTIONAL_CODE_BY_CODE_SQL,
  PROMOTIONAL_CODE_BY_ID_SQL,
  PROMOTIONAL_CODE_LIST_SQL,
  WAITLIST_ENTRY_BY_ID_SQL,
  WAITLIST_ENTRY_LIST_SQL,
} from "../sql/booking-config-queries.js";

// =====================================================
// HELPERS
// =====================================================

const toIsoString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isNaN(num) ? null : num;
};

const formatDisplayLabel = (value: string | null): string => {
  if (!value || typeof value !== "string") {
    return "Unknown";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

// =====================================================
// ALLOTMENT SERVICE
// =====================================================

type AllotmentRow = {
  allotment_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  allotment_code: string;
  allotment_name: string;
  allotment_type: string;
  allotment_status: string;
  start_date: string | Date;
  end_date: string | Date;
  cutoff_date: string | Date | null;
  room_type_id: string | null;
  total_rooms_blocked: number;
  total_room_nights: number | null;
  rooms_per_night: number | null;
  rooms_picked_up: number;
  rooms_available: number | null;
  pickup_percentage: number | string;
  rate_type: string | null;
  contracted_rate: number | string | null;
  total_expected_revenue: number | string | null;
  actual_revenue: number | string | null;
  currency_code: string;
  account_name: string | null;
  account_type: string | null;
  billing_type: string;
  contact_name: string | null;
  contact_email: string | null;
  deposit_required: boolean;
  attrition_clause: boolean;
  attrition_percentage: number | string | null;
  guaranteed_rooms: number | null;
  is_vip: boolean;
  priority_level: number;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const mapAllotmentRow = (row: AllotmentRow): AllotmentListItem => {
  return AllotmentListItemSchema.parse({
    allotment_id: row.allotment_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    allotment_code: row.allotment_code,
    allotment_name: row.allotment_name,
    allotment_type: row.allotment_type?.toLowerCase() ?? "group",
    allotment_type_display: formatDisplayLabel(row.allotment_type),
    allotment_status: row.allotment_status?.toLowerCase() ?? "tentative",
    allotment_status_display: formatDisplayLabel(row.allotment_status),
    start_date: (toIsoString(row.start_date) ?? "").split("T")[0],
    end_date: (toIsoString(row.end_date) ?? "").split("T")[0],
    cutoff_date: row.cutoff_date ? (toIsoString(row.cutoff_date) ?? "").split("T")[0] : null,
    room_type_id: row.room_type_id ?? undefined,
    total_rooms_blocked: row.total_rooms_blocked ?? 0,
    total_room_nights: row.total_room_nights,
    rooms_per_night: row.rooms_per_night,
    rooms_picked_up: row.rooms_picked_up ?? 0,
    rooms_available: row.rooms_available,
    pickup_percentage: toNumber(row.pickup_percentage) ?? 0,
    rate_type: row.rate_type,
    contracted_rate: toNumber(row.contracted_rate),
    total_expected_revenue: toNumber(row.total_expected_revenue),
    actual_revenue: toNumber(row.actual_revenue),
    currency_code: row.currency_code ?? "USD",
    account_name: row.account_name,
    account_type: row.account_type,
    billing_type: row.billing_type ?? "INDIVIDUAL",
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    deposit_required: Boolean(row.deposit_required),
    attrition_clause: Boolean(row.attrition_clause),
    attrition_percentage: toNumber(row.attrition_percentage),
    guaranteed_rooms: row.guaranteed_rooms,
    is_vip: Boolean(row.is_vip),
    priority_level: row.priority_level ?? 0,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export type ListAllotmentsInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  allotmentType?: string;
  startDateFrom?: string;
  endDateTo?: string;
  offset?: number;
};

export const listAllotments = async (
  options: ListAllotmentsInput,
): Promise<AllotmentListItem[]> => {
  const { rows } = await query<AllotmentRow>(ALLOTMENT_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.status ?? null,
    options.allotmentType ?? null,
    options.startDateFrom ?? null,
    options.endDateTo ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapAllotmentRow);
};

export type GetAllotmentInput = {
  allotmentId: string;
  tenantId: string;
};

export const getAllotmentById = async (
  options: GetAllotmentInput,
): Promise<AllotmentListItem | null> => {
  const { rows } = await query<AllotmentRow>(ALLOTMENT_BY_ID_SQL, [
    options.allotmentId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapAllotmentRow(row);
};

// =====================================================
// BOOKING SOURCE SERVICE
// =====================================================

type BookingSourceRow = {
  source_id: string;
  tenant_id: string;
  property_id: string | null;
  property_name: string | null;
  source_code: string;
  source_name: string;
  source_type: string;
  category: string | null;
  is_active: boolean;
  is_bookable: boolean;
  channel_name: string | null;
  channel_website: string | null;
  commission_type: string;
  commission_percentage: number | string | null;
  commission_fixed_amount: number | string | null;
  total_bookings: number;
  total_revenue: number | string | null;
  total_room_nights: number;
  average_booking_value: number | string | null;
  conversion_rate: number | string | null;
  cancellation_rate: number | string | null;
  ranking: number | null;
  is_preferred: boolean;
  is_featured: boolean;
  has_integration: boolean;
  integration_type: string | null;
  last_sync_at: string | Date | null;
  display_name: string | null;
  logo_url: string | null;
  color_code: string | null;
};

const mapBookingSourceRow = (row: BookingSourceRow): BookingSourceListItem => {
  return BookingSourceListItemSchema.parse({
    source_id: row.source_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    property_name: row.property_name ?? undefined,
    source_code: row.source_code,
    source_name: row.source_name,
    source_type: row.source_type?.toLowerCase() ?? "other",
    source_type_display: formatDisplayLabel(row.source_type),
    category: row.category,
    is_active: Boolean(row.is_active),
    is_bookable: Boolean(row.is_bookable),
    channel_name: row.channel_name,
    channel_website: row.channel_website,
    commission_type: row.commission_type ?? "NONE",
    commission_percentage: toNumber(row.commission_percentage),
    commission_fixed_amount: toNumber(row.commission_fixed_amount),
    total_bookings: row.total_bookings ?? 0,
    total_revenue: toNumber(row.total_revenue),
    total_room_nights: row.total_room_nights ?? 0,
    average_booking_value: toNumber(row.average_booking_value),
    conversion_rate: toNumber(row.conversion_rate),
    cancellation_rate: toNumber(row.cancellation_rate),
    ranking: row.ranking,
    is_preferred: Boolean(row.is_preferred),
    is_featured: Boolean(row.is_featured),
    has_integration: Boolean(row.has_integration),
    integration_type: row.integration_type,
    last_sync_at: toIsoString(row.last_sync_at),
    display_name: row.display_name,
    logo_url: row.logo_url,
    color_code: row.color_code,
  });
};

export type ListBookingSourcesInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  sourceType?: string;
  isActive?: boolean;
  hasIntegration?: boolean;
  offset?: number;
};

export const listBookingSources = async (
  options: ListBookingSourcesInput,
): Promise<BookingSourceListItem[]> => {
  const { rows } = await query<BookingSourceRow>(BOOKING_SOURCE_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.sourceType ?? null,
    options.isActive ?? null,
    options.hasIntegration ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapBookingSourceRow);
};

export type GetBookingSourceInput = {
  sourceId: string;
  tenantId: string;
};

export const getBookingSourceById = async (
  options: GetBookingSourceInput,
): Promise<BookingSourceListItem | null> => {
  const { rows } = await query<BookingSourceRow>(BOOKING_SOURCE_BY_ID_SQL, [
    options.sourceId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapBookingSourceRow(row);
};

// =====================================================
// MARKET SEGMENT SERVICE
// =====================================================

type MarketSegmentRow = {
  segment_id: string;
  tenant_id: string;
  property_id: string | null;
  property_name: string | null;
  segment_code: string;
  segment_name: string;
  segment_type: string;
  is_active: boolean;
  is_bookable: boolean;
  parent_segment_id: string | null;
  segment_level: number;
  average_daily_rate: number | string | null;
  average_length_of_stay: number | string | null;
  average_booking_value: number | string | null;
  contribution_to_revenue: number | string | null;
  booking_lead_time_days: number | null;
  cancellation_rate: number | string | null;
  no_show_rate: number | string | null;
  repeat_guest_rate: number | string | null;
  total_bookings: number;
  total_room_nights: number;
  total_revenue: number | string | null;
  rate_multiplier: number | string;
  discount_percentage: number | string | null;
  premium_percentage: number | string | null;
  pays_commission: boolean;
  commission_percentage: number | string | null;
  marketing_priority: number;
  is_target_segment: boolean;
  lifetime_value: number | string | null;
  loyalty_program_eligible: boolean;
  loyalty_points_multiplier: number | string;
  ranking: number | null;
  color_code: string | null;
  description: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

const mapMarketSegmentRow = (row: MarketSegmentRow): MarketSegmentListItem => {
  return MarketSegmentListItemSchema.parse({
    segment_id: row.segment_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    property_name: row.property_name ?? undefined,
    segment_code: row.segment_code,
    segment_name: row.segment_name,
    segment_type: row.segment_type?.toLowerCase() ?? "other",
    segment_type_display: formatDisplayLabel(row.segment_type),
    is_active: Boolean(row.is_active),
    is_bookable: Boolean(row.is_bookable),
    parent_segment_id: row.parent_segment_id ?? undefined,
    segment_level: row.segment_level ?? 1,
    average_daily_rate: toNumber(row.average_daily_rate),
    average_length_of_stay: toNumber(row.average_length_of_stay),
    average_booking_value: toNumber(row.average_booking_value),
    contribution_to_revenue: toNumber(row.contribution_to_revenue),
    booking_lead_time_days: row.booking_lead_time_days,
    cancellation_rate: toNumber(row.cancellation_rate),
    no_show_rate: toNumber(row.no_show_rate),
    repeat_guest_rate: toNumber(row.repeat_guest_rate),
    total_bookings: row.total_bookings ?? 0,
    total_room_nights: row.total_room_nights ?? 0,
    total_revenue: toNumber(row.total_revenue),
    rate_multiplier: toNumber(row.rate_multiplier) ?? 1,
    discount_percentage: toNumber(row.discount_percentage),
    premium_percentage: toNumber(row.premium_percentage),
    pays_commission: Boolean(row.pays_commission),
    commission_percentage: toNumber(row.commission_percentage),
    marketing_priority: row.marketing_priority ?? 0,
    is_target_segment: Boolean(row.is_target_segment),
    lifetime_value: toNumber(row.lifetime_value),
    loyalty_program_eligible: Boolean(row.loyalty_program_eligible),
    loyalty_points_multiplier: toNumber(row.loyalty_points_multiplier) ?? 1,
    ranking: row.ranking,
    color_code: row.color_code,
    description: row.description,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  });
};

export type ListMarketSegmentsInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  segmentType?: string;
  isActive?: boolean;
  parentSegmentId?: string;
  offset?: number;
};

export const listMarketSegments = async (
  options: ListMarketSegmentsInput,
): Promise<MarketSegmentListItem[]> => {
  const { rows } = await query<MarketSegmentRow>(MARKET_SEGMENT_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.segmentType ?? null,
    options.isActive ?? null,
    options.parentSegmentId ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapMarketSegmentRow);
};

export type GetMarketSegmentInput = {
  segmentId: string;
  tenantId: string;
};

export const getMarketSegmentById = async (
  options: GetMarketSegmentInput,
): Promise<MarketSegmentListItem | null> => {
  const { rows } = await query<MarketSegmentRow>(MARKET_SEGMENT_BY_ID_SQL, [
    options.segmentId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapMarketSegmentRow(row);
};

// =====================================================
// CHANNEL MAPPING SERVICE
// =====================================================

type ChannelMappingRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  channel_name: string;
  channel_code: string;
  entity_type: string;
  entity_id: string;
  external_id: string;
  external_code: string | null;
  mapping_config: Record<string, unknown> | null;
  last_sync_at: string | Date | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const mapChannelMappingRow = (row: ChannelMappingRow): ChannelMappingListItem => {
  return ChannelMappingListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    channel_name: row.channel_name,
    channel_code: row.channel_code,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    external_id: row.external_id,
    external_code: row.external_code,
    mapping_config: row.mapping_config,
    last_sync_at: toIsoString(row.last_sync_at),
    last_sync_status: row.last_sync_status,
    last_sync_error: row.last_sync_error,
    is_active: Boolean(row.is_active),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export type ListChannelMappingsInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  channelCode?: string;
  entityType?: string;
  isActive?: boolean;
  offset?: number;
};

export const listChannelMappings = async (
  options: ListChannelMappingsInput,
): Promise<ChannelMappingListItem[]> => {
  const { rows } = await query<ChannelMappingRow>(CHANNEL_MAPPING_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.channelCode ?? null,
    options.entityType ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapChannelMappingRow);
};

export type GetChannelMappingInput = {
  mappingId: string;
  tenantId: string;
};

export const getChannelMappingById = async (
  options: GetChannelMappingInput,
): Promise<ChannelMappingListItem | null> => {
  const { rows } = await query<ChannelMappingRow>(CHANNEL_MAPPING_BY_ID_SQL, [
    options.mappingId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapChannelMappingRow(row);
};

// =====================================================
// COMPANY SERVICE
// =====================================================

type CompanyRow = {
  company_id: string;
  tenant_id: string;
  company_name: string;
  legal_name: string | null;
  company_code: string | null;
  company_type: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  credit_limit: number | string;
  current_balance: number | string;
  payment_terms: number;
  payment_terms_type: string;
  credit_status: string;
  commission_rate: number | string;
  commission_type: string | null;
  preferred_rate_code: string | null;
  discount_percentage: number | string;
  tax_id: string | null;
  tax_exempt: boolean;
  contract_number: string | null;
  contract_start_date: string | Date | null;
  contract_end_date: string | Date | null;
  contract_status: string | null;
  iata_number: string | null;
  arc_number: string | null;
  total_bookings: number;
  total_revenue: number | string;
  average_booking_value: number | string | null;
  last_booking_date: string | Date | null;
  is_active: boolean;
  is_vip: boolean;
  is_blacklisted: boolean;
  requires_approval: boolean;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const mapCompanyRow = (row: CompanyRow): CompanyListItem => {
  return CompanyListItemSchema.parse({
    company_id: row.company_id,
    tenant_id: row.tenant_id,
    company_name: row.company_name,
    legal_name: row.legal_name,
    company_code: row.company_code,
    company_type: row.company_type?.toLowerCase() ?? "corporate",
    company_type_display: formatDisplayLabel(row.company_type),
    primary_contact_name: row.primary_contact_name,
    primary_contact_email: row.primary_contact_email,
    primary_contact_phone: row.primary_contact_phone,
    billing_contact_name: row.billing_contact_name,
    billing_contact_email: row.billing_contact_email,
    city: row.city,
    state_province: row.state_province,
    country: row.country,
    credit_limit: toNumber(row.credit_limit) ?? 0,
    current_balance: toNumber(row.current_balance) ?? 0,
    payment_terms: row.payment_terms ?? 30,
    payment_terms_type: row.payment_terms_type ?? "net_30",
    credit_status: row.credit_status?.toLowerCase() ?? "active",
    credit_status_display: formatDisplayLabel(row.credit_status),
    commission_rate: toNumber(row.commission_rate) ?? 0,
    commission_type: row.commission_type,
    preferred_rate_code: row.preferred_rate_code,
    discount_percentage: toNumber(row.discount_percentage) ?? 0,
    tax_id: row.tax_id,
    tax_exempt: Boolean(row.tax_exempt),
    contract_number: row.contract_number,
    contract_start_date: row.contract_start_date
      ? (toIsoString(row.contract_start_date) ?? "").split("T")[0]
      : null,
    contract_end_date: row.contract_end_date
      ? (toIsoString(row.contract_end_date) ?? "").split("T")[0]
      : null,
    contract_status: row.contract_status,
    iata_number: row.iata_number,
    arc_number: row.arc_number,
    total_bookings: row.total_bookings ?? 0,
    total_revenue: toNumber(row.total_revenue) ?? 0,
    average_booking_value: toNumber(row.average_booking_value),
    last_booking_date: row.last_booking_date
      ? (toIsoString(row.last_booking_date) ?? "").split("T")[0]
      : null,
    is_active: Boolean(row.is_active),
    is_vip: Boolean(row.is_vip),
    is_blacklisted: Boolean(row.is_blacklisted),
    requires_approval: Boolean(row.requires_approval),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export type ListCompaniesInput = {
  limit?: number;
  tenantId: string;
  companyType?: string;
  isActive?: boolean;
  creditStatus?: string;
  isBlacklisted?: boolean;
  offset?: number;
};

export const listCompanies = async (options: ListCompaniesInput): Promise<CompanyListItem[]> => {
  const { rows } = await query<CompanyRow>(COMPANY_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.companyType ?? null,
    options.isActive ?? null,
    options.creditStatus ?? null,
    options.isBlacklisted ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapCompanyRow);
};

export type GetCompanyInput = {
  companyId: string;
  tenantId: string;
};

export const getCompanyById = async (options: GetCompanyInput): Promise<CompanyListItem | null> => {
  const { rows } = await query<CompanyRow>(COMPANY_BY_ID_SQL, [
    options.companyId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapCompanyRow(row);
};

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

// =====================================================
// WAITLIST ENTRY SERVICE
// =====================================================

type WaitlistEntryRow = {
  waitlist_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  guest_id: string | null;
  guest_name: string | null;
  reservation_id: string | null;
  requested_room_type_id: string | null;
  room_type_name: string | null;
  requested_rate_id: string | null;
  arrival_date: string | Date;
  departure_date: string | Date;
  nights: number;
  number_of_rooms: number;
  number_of_adults: number;
  number_of_children: number;
  flexibility: string;
  waitlist_status: string;
  priority_score: number;
  vip_flag: boolean;
  last_notified_at: string | Date | null;
  last_notified_via: string | null;
  offer_expiration_at: string | Date | null;
  offer_response: string | null;
  offer_response_at: string | Date | null;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const mapWaitlistEntryRow = (row: WaitlistEntryRow): WaitlistEntryListItem => {
  return WaitlistEntryListItemSchema.parse({
    waitlist_id: row.waitlist_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    requested_room_type_id: row.requested_room_type_id ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
    requested_rate_id: row.requested_rate_id ?? undefined,
    arrival_date: (toIsoString(row.arrival_date) ?? "").split("T")[0],
    departure_date: (toIsoString(row.departure_date) ?? "").split("T")[0],
    nights: row.nights ?? 0,
    number_of_rooms: row.number_of_rooms ?? 1,
    number_of_adults: row.number_of_adults ?? 1,
    number_of_children: row.number_of_children ?? 0,
    flexibility: row.flexibility?.toUpperCase() ?? "NONE",
    flexibility_display: formatDisplayLabel(row.flexibility),
    waitlist_status: row.waitlist_status?.toUpperCase() ?? "ACTIVE",
    waitlist_status_display: formatDisplayLabel(row.waitlist_status),
    priority_score: row.priority_score ?? 0,
    vip_flag: Boolean(row.vip_flag),
    last_notified_at: toIsoString(row.last_notified_at),
    last_notified_via: row.last_notified_via,
    offer_expiration_at: toIsoString(row.offer_expiration_at),
    offer_response: row.offer_response,
    offer_response_at: toIsoString(row.offer_response_at),
    notes: row.notes,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export type ListWaitlistEntriesInput = {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  waitlistStatus?: string;
  arrivalDateFrom?: string;
  arrivalDateTo?: string;
  isVip?: boolean;
  offset?: number;
};

export const listWaitlistEntries = async (
  options: ListWaitlistEntriesInput,
): Promise<WaitlistEntryListItem[]> => {
  const { rows } = await query<WaitlistEntryRow>(WAITLIST_ENTRY_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.waitlistStatus ?? null,
    options.arrivalDateFrom ?? null,
    options.arrivalDateTo ?? null,
    options.isVip ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapWaitlistEntryRow);
};

export type GetWaitlistEntryInput = {
  waitlistId: string;
  tenantId: string;
};

export const getWaitlistEntryById = async (
  options: GetWaitlistEntryInput,
): Promise<WaitlistEntryListItem | null> => {
  const { rows } = await query<WaitlistEntryRow>(WAITLIST_ENTRY_BY_ID_SQL, [
    options.waitlistId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapWaitlistEntryRow(row);
};

// =====================================================
// GROUP BOOKING SERVICE
// =====================================================

type GroupBookingRow = {
  group_booking_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  group_name: string;
  group_code: string | null;
  group_type: string;
  block_status: string;
  company_id: string | null;
  company_name: string | null;
  organization_name: string | null;
  event_name: string | null;
  event_type: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  arrival_date: string;
  departure_date: string;
  number_of_nights: number | null;
  total_rooms_requested: number;
  total_rooms_blocked: number | null;
  total_rooms_picked: number | null;
  total_rooms_confirmed: number | null;
  cutoff_date: string;
  cutoff_days_before_arrival: number | null;
  release_unsold_rooms: boolean | null;
  rooming_list_received: boolean | null;
  rooming_list_deadline: string | null;
  deposit_amount: string | null;
  deposit_received: boolean | null;
  negotiated_rate: string | null;
  estimated_total_revenue: string | null;
  actual_revenue: string | null;
  contract_signed: boolean | null;
  is_active: boolean;
  booking_confidence: string | null;
  account_manager_id: string | null;
  account_manager_name: string | null;
  sales_manager_id: string | null;
  created_at: string;
  updated_at: string | null;
};

const mapGroupBookingRow = (row: GroupBookingRow): GroupBookingListItem => {
  const totalBlocked = row.total_rooms_blocked ?? 0;
  const totalPicked = row.total_rooms_picked ?? 0;
  const pickupPercentage = totalBlocked > 0 ? (totalPicked / totalBlocked) * 100 : 0;

  return GroupBookingListItemSchema.parse({
    group_booking_id: row.group_booking_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    group_name: row.group_name,
    group_code: row.group_code,
    group_type: row.group_type,
    group_type_display: formatDisplayLabel(row.group_type),
    block_status: row.block_status ?? "TENTATIVE",
    block_status_display: formatDisplayLabel(row.block_status ?? "TENTATIVE"),
    company_id: row.company_id ?? undefined,
    company_name: row.company_name ?? undefined,
    organization_name: row.organization_name,
    event_name: row.event_name,
    event_type: row.event_type,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    arrival_date: toIsoString(row.arrival_date) ?? "",
    departure_date: toIsoString(row.departure_date) ?? "",
    number_of_nights: row.number_of_nights ?? 0,
    total_rooms_requested: row.total_rooms_requested,
    total_rooms_blocked: totalBlocked,
    total_rooms_picked: totalPicked,
    total_rooms_confirmed: row.total_rooms_confirmed ?? 0,
    pickup_percentage: Math.round(pickupPercentage * 100) / 100,
    cutoff_date: toIsoString(row.cutoff_date) ?? "",
    cutoff_days_before_arrival: row.cutoff_days_before_arrival,
    release_unsold_rooms: row.release_unsold_rooms ?? true,
    rooming_list_received: row.rooming_list_received ?? false,
    rooming_list_deadline: toIsoString(row.rooming_list_deadline) ?? null,
    deposit_amount: row.deposit_amount,
    deposit_received: row.deposit_received ?? false,
    negotiated_rate: row.negotiated_rate,
    estimated_total_revenue: row.estimated_total_revenue,
    actual_revenue: row.actual_revenue,
    contract_signed: row.contract_signed ?? false,
    is_active: row.is_active ?? true,
    booking_confidence: row.booking_confidence,
    account_manager_id: row.account_manager_id ?? undefined,
    account_manager_name: row.account_manager_name ?? undefined,
    sales_manager_id: row.sales_manager_id ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? undefined,
  });
};

export type ListGroupBookingsInput = {
  tenantId: string;
  propertyId?: string;
  blockStatus?: string;
  groupType?: string;
  arrivalDateFrom?: string;
  arrivalDateTo?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

export const listGroupBookings = async (
  options: ListGroupBookingsInput,
): Promise<GroupBookingListItem[]> => {
  const { rows } = await query<GroupBookingRow>(GROUP_BOOKING_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.blockStatus ?? null,
    options.groupType ?? null,
    options.arrivalDateFrom ?? null,
    options.arrivalDateTo ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapGroupBookingRow);
};

export type GetGroupBookingInput = {
  groupBookingId: string;
  tenantId: string;
};

export const getGroupBookingById = async (
  options: GetGroupBookingInput,
): Promise<GroupBookingListItem | null> => {
  const { rows } = await query<GroupBookingRow>(GROUP_BOOKING_BY_ID_SQL, [
    options.groupBookingId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapGroupBookingRow(row);
};

// =====================================================
// PROMOTIONAL CODE SERVICE
// =====================================================

type PromotionalCodeRow = {
  promo_id: string;
  tenant_id: string;
  property_id: string | null;
  property_name: string | null;
  promo_code: string;
  promo_name: string;
  promo_description: string | null;
  promo_type: string | null;
  promo_status: string | null;
  is_active: boolean | null;
  is_public: boolean | null;
  valid_from: string;
  valid_to: string;
  discount_type: string | null;
  discount_percent: string | null;
  discount_amount: string | null;
  discount_currency: string | null;
  max_discount_amount: string | null;
  free_nights_count: number | null;
  has_usage_limit: boolean | null;
  total_usage_limit: number | null;
  usage_count: number | null;
  remaining_uses: number | null;
  per_user_limit: number | null;
  minimum_stay_nights: number | null;
  maximum_stay_nights: number | null;
  minimum_booking_amount: string | null;
  times_viewed: number | null;
  times_applied: number | null;
  times_redeemed: number | null;
  total_discount_given: string | null;
  total_revenue_generated: string | null;
  conversion_rate: string | null;
  combinable_with_other_promos: boolean | null;
  auto_apply: boolean | null;
  display_on_website: boolean | null;
  requires_approval: boolean | null;
  campaign_id: string | null;
  marketing_source: string | null;
  created_at: string;
  updated_at: string | null;
};

const mapPromotionalCodeRow = (row: PromotionalCodeRow): PromotionalCodeListItem => {
  return PromotionalCodeListItemSchema.parse({
    promo_id: row.promo_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    property_name: row.property_name ?? undefined,
    promo_code: row.promo_code,
    promo_name: row.promo_name,
    promo_description: row.promo_description,
    promo_type: row.promo_type,
    promo_status: row.promo_status ?? "ACTIVE",
    promo_status_display: formatDisplayLabel(row.promo_status ?? "ACTIVE"),
    is_active: row.is_active ?? true,
    is_public: row.is_public ?? false,
    valid_from: toIsoString(row.valid_from) ?? "",
    valid_to: toIsoString(row.valid_to) ?? "",
    discount_type: row.discount_type,
    discount_type_display: row.discount_type ? formatDisplayLabel(row.discount_type) : null,
    discount_percent: row.discount_percent,
    discount_amount: row.discount_amount,
    discount_currency: row.discount_currency,
    max_discount_amount: row.max_discount_amount,
    free_nights_count: row.free_nights_count,
    has_usage_limit: row.has_usage_limit ?? false,
    total_usage_limit: row.total_usage_limit,
    usage_count: row.usage_count ?? 0,
    remaining_uses: row.remaining_uses,
    per_user_limit: row.per_user_limit,
    minimum_stay_nights: row.minimum_stay_nights,
    maximum_stay_nights: row.maximum_stay_nights,
    minimum_booking_amount: row.minimum_booking_amount,
    times_viewed: row.times_viewed ?? 0,
    times_applied: row.times_applied ?? 0,
    times_redeemed: row.times_redeemed ?? 0,
    total_discount_given: row.total_discount_given,
    total_revenue_generated: row.total_revenue_generated,
    conversion_rate: row.conversion_rate,
    combinable_with_other_promos: row.combinable_with_other_promos ?? false,
    auto_apply: row.auto_apply ?? false,
    display_on_website: row.display_on_website ?? false,
    requires_approval: row.requires_approval ?? false,
    campaign_id: row.campaign_id ?? undefined,
    marketing_source: row.marketing_source,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? undefined,
  });
};

export type ListPromotionalCodesInput = {
  tenantId: string;
  propertyId?: string;
  promoStatus?: string;
  isActive?: boolean;
  isPublic?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

export const listPromotionalCodes = async (
  options: ListPromotionalCodesInput,
): Promise<PromotionalCodeListItem[]> => {
  const { rows } = await query<PromotionalCodeRow>(PROMOTIONAL_CODE_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.promoStatus ?? null,
    options.isActive ?? null,
    options.isPublic ?? null,
    options.search ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapPromotionalCodeRow);
};

export type GetPromotionalCodeInput = {
  promoId: string;
  tenantId: string;
};

export const getPromotionalCodeById = async (
  options: GetPromotionalCodeInput,
): Promise<PromotionalCodeListItem | null> => {
  const { rows } = await query<PromotionalCodeRow>(PROMOTIONAL_CODE_BY_ID_SQL, [
    options.promoId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapPromotionalCodeRow(row);
};

export type ValidatePromoCodeInput = {
  promoCode: string;
  tenantId: string;
  propertyId?: string;
  arrivalDate: string;
  departureDate: string;
  roomTypeId?: string;
  rateCode?: string;
  bookingAmount?: number;
  guestId?: string;
  channel?: string;
};

export const validatePromoCode = async (
  input: ValidatePromoCodeInput,
): Promise<{
  valid: boolean;
  promoId?: string;
  promoName?: string;
  discountType?: string;
  discountValue?: string;
  message?: string;
  rejectionReason?: string;
}> => {
  const { rows } = await query<PromotionalCodeRow>(PROMOTIONAL_CODE_BY_CODE_SQL, [
    input.promoCode,
    input.tenantId,
    input.propertyId ?? null,
  ]);

  const promo = rows[0];
  if (!promo) {
    return { valid: false, rejectionReason: "Promo code not found" };
  }

  // Check if active
  if (!promo.is_active) {
    return { valid: false, rejectionReason: "Promo code is not active" };
  }

  // Check validity dates
  const now = new Date();
  const validFrom = new Date(promo.valid_from);
  const validTo = new Date(promo.valid_to);
  if (now < validFrom) {
    return { valid: false, rejectionReason: "Promo code is not yet valid" };
  }
  if (now > validTo) {
    return { valid: false, rejectionReason: "Promo code has expired" };
  }

  // Check usage limits
  if (promo.has_usage_limit && promo.remaining_uses !== null && promo.remaining_uses <= 0) {
    return { valid: false, rejectionReason: "Promo code usage limit reached" };
  }

  // Calculate discount value
  let discountValue: string | undefined;
  if (promo.discount_type === "PERCENTAGE" && promo.discount_percent) {
    discountValue = `${promo.discount_percent}%`;
  } else if (promo.discount_type === "FIXED_AMOUNT" && promo.discount_amount) {
    discountValue = `${promo.discount_currency ?? "USD"} ${promo.discount_amount}`;
  } else if (promo.discount_type === "FREE_NIGHTS" && promo.free_nights_count) {
    discountValue = `${promo.free_nights_count} free night(s)`;
  }

  return {
    valid: true,
    promoId: promo.promo_id,
    promoName: promo.promo_name,
    discountType: promo.discount_type ?? undefined,
    discountValue,
    message: `Promo code "${promo.promo_code}" is valid`,
  };
};
