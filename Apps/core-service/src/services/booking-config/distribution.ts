import {
  type BookingSourceListItem,
  BookingSourceListItemSchema,
  type BookingSourceRow,
  type ChannelMappingListItem,
  ChannelMappingListItemSchema,
  type ChannelMappingRow,
  type GetBookingSourceInput,
  type GetChannelMappingInput,
  type GetMarketSegmentInput,
  type ListBookingSourcesInput,
  type ListChannelMappingsInput,
  type ListMarketSegmentsInput,
  type MarketSegmentListItem,
  MarketSegmentListItemSchema,
  type MarketSegmentRow,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import {
  BOOKING_SOURCE_BY_ID_SQL,
  BOOKING_SOURCE_LIST_SQL,
  CHANNEL_MAPPING_BY_ID_SQL,
  CHANNEL_MAPPING_LIST_SQL,
  MARKET_SEGMENT_BY_ID_SQL,
  MARKET_SEGMENT_LIST_SQL,
} from "../../sql/booking-config/distribution.js";

import { formatDisplayLabel, toIsoString, toNumber } from "./common.js";

// =====================================================
// BOOKING SOURCE SERVICE
// =====================================================

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
