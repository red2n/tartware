import {
  type BookingSourceListItem,
  BookingSourceListItemSchema,
  type BookingSourceRow,
  type BookingSourceWriteInput,
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
  type MarketSegmentWriteInput,
  type ReasonCodeListItem,
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

import {
  formatDisplayLabel,
  isUniqueViolationOn,
  ReferenceCodeConflictError,
  toIsoString,
  toNumber,
} from "./common.js";

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
// BOOKING SOURCES — WRITE PATH
//
// Reference data on one service with no fan-out, so plain HTTP per
// ui-gaps/18-write-path-gap.md. Performance columns are machine-maintained and
// are not part of any write body. See ui-gaps/14-channel-distribution.md.
// =====================================================

/** Create a booking source. */
export const createBookingSource = async (
  tenantId: string,
  input: BookingSourceWriteInput,
  actorId?: string,
): Promise<BookingSourceListItem | null> => {
  // A duplicate `source_code` is an operator typing a code that already exists,
  // not a fault: the UNIQUE index is caught by name and reported as a conflict.
  // Mirrors createMeetingRoom in booking-config/event.ts.
  let rows: { source_id: string }[];
  try {
    ({ rows } = await query<{ source_id: string }>(
      `
      INSERT INTO public.booking_sources (
        tenant_id, property_id,
        source_code, source_name, source_type,
        category, sub_category,
        is_active, is_bookable,
        channel_name, channel_website, channel_manager,
        commission_type, commission_percentage, commission_fixed_amount, commission_notes,
        ranking, is_preferred,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid,
        $3, $4, $5,
        $6, $7,
        COALESCE($8, true), COALESCE($9, true),
        $10, $11, $12,
        COALESCE($13, 'PERCENTAGE'), $14, $15, $16,
        $17, COALESCE($18, false),
        $19, $19
      )
      RETURNING source_id
    `,
      [
        tenantId,
        input.propertyId ?? null,
        input.sourceCode,
        input.sourceName,
        input.sourceType,
        input.category ?? null,
        input.subCategory ?? null,
        input.isActive ?? null,
        input.isBookable ?? null,
        input.channelName ?? null,
        input.channelWebsite ?? null,
        input.channelManager ?? null,
        input.commissionType ?? null,
        input.commissionPercentage ?? null,
        input.commissionFixedAmount ?? null,
        input.commissionNotes ?? null,
        input.ranking ?? null,
        input.isPreferred ?? null,
        actorId ?? null,
      ],
    ));
  } catch (error) {
    if (isUniqueViolationOn(error, "uk_booking_sources_code")) {
      throw new ReferenceCodeConflictError(
        `Booking source code ${input.sourceCode} already exists for this property`,
      );
    }
    throw error;
  }

  const sourceId = rows[0]?.source_id;
  if (!sourceId) return null;

  return getBookingSourceById({ sourceId, tenantId });
};

/**
 * Edit a booking source. `source_code` is not settable — reservations carry it,
 * so rewriting it orphans every booking already attributed to this source.
 */
export const updateBookingSource = async (
  tenantId: string,
  sourceId: string,
  input: Partial<BookingSourceWriteInput>,
  actorId?: string,
): Promise<BookingSourceListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.booking_sources
      SET
        source_name = COALESCE($3, source_name),
        source_type = COALESCE($4, source_type),
        category = COALESCE($5, category),
        sub_category = COALESCE($6, sub_category),
        is_active = COALESCE($7, is_active),
        is_bookable = COALESCE($8, is_bookable),
        channel_name = COALESCE($9, channel_name),
        channel_website = COALESCE($10, channel_website),
        channel_manager = COALESCE($11, channel_manager),
        commission_type = COALESCE($12, commission_type),
        commission_percentage = COALESCE($13, commission_percentage),
        commission_fixed_amount = COALESCE($14, commission_fixed_amount),
        commission_notes = COALESCE($15, commission_notes),
        ranking = COALESCE($16, ranking),
        is_preferred = COALESCE($17, is_preferred),
        updated_by = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE source_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      sourceId,
      tenantId,
      input.sourceName ?? null,
      input.sourceType ?? null,
      input.category ?? null,
      input.subCategory ?? null,
      input.isActive ?? null,
      input.isBookable ?? null,
      input.channelName ?? null,
      input.channelWebsite ?? null,
      input.channelManager ?? null,
      input.commissionType ?? null,
      input.commissionPercentage ?? null,
      input.commissionFixedAmount ?? null,
      input.commissionNotes ?? null,
      input.ranking ?? null,
      input.isPreferred ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getBookingSourceById({ sourceId, tenantId });
};

/**
 * Retire a booking source.
 *
 * Soft delete, and `is_bookable` is cleared with it: historic reservations still
 * reference the source for production reporting, so the row must stay, but no new
 * booking should be able to pick it.
 */
export const deleteBookingSource = async (
  tenantId: string,
  sourceId: string,
  actorId?: string,
): Promise<boolean> => {
  const { rowCount } = await query(
    `
      UPDATE public.booking_sources
      SET is_deleted = true,
          is_active = false,
          is_bookable = false,
          updated_by = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE source_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [sourceId, tenantId, actorId ?? null],
  );

  return (rowCount ?? 0) > 0;
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

/**
 * List the reason codes an operator may choose from.
 *
 * Property-scoped codes and tenant-wide ones come back together, ordered so a
 * picker shows the property's own overrides alongside the chain defaults.
 * The reversal commands resolve the chosen code again server-side — this list
 * is for discovery, not authorisation.
 */
/** The all-zero tenant the product's own reference codes are seeded under. */
const SYSTEM_REASON_TENANT = "00000000-0000-0000-0000-000000000000";

/**
 * List the reason codes an operator may pick, as the handlers will read them.
 *
 * **The resolution has to match `resolveReasonCode`, and for a long time it did
 * not.** That helper — in `@tartware/command-consumer-utils` — resolves a code
 * across three levels, most specific first: the property's own, then the
 * tenant's, then the system defaults under the all-zero tenant. This listing
 * read `tenant_id = $1` alone. Since every one of the forty-six codes the
 * product ships is seeded under the system tenant, the route returned an empty
 * array to every tenant that had not written its own, while every command
 * handler accepted all forty-six. An operator could not see a code that would
 * have worked, and could not tell that from there being none.
 *
 * `DISTINCT ON (reason_code)` with the same ordering the resolver uses collapses
 * the levels the same way, so a tenant that overrides `WO_GOODWILL` sees its own
 * row and not both. Ordering the *output* then needs a second pass, because
 * `DISTINCT ON` fixes the sort of the inner query.
 */
export const listReasonCodes = async (options: {
  tenantId: string;
  propertyId?: string;
  category?: string;
  limit?: number;
}): Promise<ReasonCodeListItem[]> => {
  const { rows } = await query<ReasonCodeListItem>(
    `SELECT * FROM (
       SELECT DISTINCT ON (UPPER(reason_code))
              reason_id, reason_code, reason_name, reason_description,
              reason_category, property_id, requires_approval, approval_level,
              has_financial_impact, display_order, is_active,
              (tenant_id = $5::uuid) AS is_system_default
         FROM public.reason_codes
        WHERE tenant_id IN ($1::uuid, $5::uuid)
          AND COALESCE(is_active, true) = true
          AND COALESCE(is_deleted, false) = false
          AND (property_id IS NULL OR $2::uuid IS NULL OR property_id = $2::uuid)
          AND ($3::text IS NULL OR UPPER(reason_category) = UPPER($3::text))
        ORDER BY UPPER(reason_code),
                 (tenant_id = $1::uuid) DESC,
                 property_id NULLS LAST
     ) resolved
     ORDER BY reason_category, display_order, reason_code
     LIMIT $4`,
    [
      options.tenantId,
      options.propertyId ?? null,
      options.category ?? null,
      options.limit ?? 200,
      SYSTEM_REASON_TENANT,
    ],
  );
  return rows;
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
// MARKET SEGMENTS — WRITE PATH
//
// `/v1/reports/market-segment-production` has always read these, so the report
// grouped by a dimension nobody could populate.
// See ui-gaps/14-channel-distribution.md.
// =====================================================

/** Create a market segment. */
export const createMarketSegment = async (
  tenantId: string,
  input: MarketSegmentWriteInput,
  actorId?: string,
): Promise<MarketSegmentListItem | null> => {
  // Same conflict handling as booking sources above: a duplicate `segment_code`
  // is a 409, not a 500 carrying a Postgres error string.
  let rows: { segment_id: string }[];
  try {
    ({ rows } = await query<{ segment_id: string }>(
      `
      INSERT INTO public.market_segments (
        tenant_id, property_id,
        segment_code, segment_name, segment_type,
        is_active, is_bookable,
        parent_segment_id, segment_level,
        rate_multiplier,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid,
        $3, $4, $5,
        COALESCE($6, true), COALESCE($7, true),
        $8::uuid,
        -- A sub-segment sits one level below its parent; a root segment is level 1.
        CASE WHEN $8::uuid IS NULL THEN 1 ELSE COALESCE(
          (SELECT segment_level + 1 FROM public.market_segments
            WHERE segment_id = $8::uuid AND tenant_id = $1::uuid), 2
        ) END,
        COALESCE($9, 1.0),
        $10, $10
      )
      RETURNING segment_id
    `,
      [
        tenantId,
        input.propertyId ?? null,
        input.segmentCode,
        input.segmentName,
        input.segmentType,
        input.isActive ?? null,
        input.isBookable ?? null,
        input.parentSegmentId ?? null,
        input.rateMultiplier ?? null,
        actorId ?? null,
      ],
    ));
  } catch (error) {
    if (isUniqueViolationOn(error, "uk_market_segments_code")) {
      throw new ReferenceCodeConflictError(
        `Market segment code ${input.segmentCode} already exists for this property`,
      );
    }
    throw error;
  }

  const segmentId = rows[0]?.segment_id;
  if (!segmentId) return null;

  return getMarketSegmentById({ segmentId, tenantId });
};

/**
 * Edit a market segment. `segment_code` is fixed — reservations carry it, and
 * production reporting groups on it.
 */
export const updateMarketSegment = async (
  tenantId: string,
  segmentId: string,
  input: Partial<MarketSegmentWriteInput>,
  actorId?: string,
): Promise<MarketSegmentListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.market_segments
      SET
        segment_name = COALESCE($3, segment_name),
        segment_type = COALESCE($4, segment_type),
        is_active = COALESCE($5, is_active),
        is_bookable = COALESCE($6, is_bookable),
        rate_multiplier = COALESCE($7, rate_multiplier),
        updated_by = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE segment_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      segmentId,
      tenantId,
      input.segmentName ?? null,
      input.segmentType ?? null,
      input.isActive ?? null,
      input.isBookable ?? null,
      input.rateMultiplier ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getMarketSegmentById({ segmentId, tenantId });
};

/**
 * Retire a market segment.
 *
 * Refused while sub-segments still point at it: orphaning them would leave rows
 * whose `segment_level` describes a hierarchy that no longer exists.
 */
export const deleteMarketSegment = async (
  tenantId: string,
  segmentId: string,
  actorId?: string,
): Promise<{ removed: boolean; reason?: string }> => {
  const { rows } = await query<{ child_count: string }>(
    `SELECT COUNT(*)::text AS child_count
       FROM public.market_segments
      WHERE parent_segment_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false`,
    [segmentId, tenantId],
  );

  if (Number(rows[0]?.child_count ?? 0) > 0) {
    return { removed: false, reason: "SEGMENT_HAS_CHILDREN" };
  }

  const { rowCount } = await query(
    `
      UPDATE public.market_segments
      SET is_deleted = true,
          is_active = false,
          is_bookable = false,
          updated_by = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE segment_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [segmentId, tenantId, actorId ?? null],
  );

  return { removed: (rowCount ?? 0) > 0 };
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
