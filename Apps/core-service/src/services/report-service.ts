import {
  type DemandForecastReport,
  DemandForecastReportSchema,
  GuestListItemSchema,
  type GuestListReport,
  GuestListReportSchema,
  type OccupancyReport,
  OccupancyReportSchema,
  type PaceReport,
  PaceReportSchema,
  type PerformanceReport,
  PerformanceReportSchema,
  ReservationSourceSummarySchema,
  type ReservationStatusSummary,
  ReservationStatusSummarySchema,
  type RevenueForecastReport,
  RevenueForecastReportSchema,
  type RevenueKpiReport,
  RevenueKpiReportSchema,
  RevenueSummarySchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  ARRIVALS_COUNT_SQL,
  ARRIVALS_LIST_SQL,
  DEPARTURES_COUNT_SQL,
  DEPARTURES_LIST_SQL,
  IN_HOUSE_COUNT_SQL,
  IN_HOUSE_LIST_SQL,
  OCCUPANCY_REPORT_SQL,
  RESERVATION_SOURCE_SUMMARY_SQL,
  RESERVATION_STATUS_SUMMARY_SQL,
  REVENUE_KPI_SQL,
  REVENUE_SUMMARY_SQL,
} from "../sql/report-queries.js";
import { toNonNegativeInt, toNumberOrFallback } from "../utils/numbers.js";

// Re-export for consumers that import from this module
export {
  PerformanceReportSchema,
  ReservationSourceSummarySchema,
  ReservationStatusSummarySchema,
  RevenueSummarySchema,
  OccupancyReportSchema,
  RevenueKpiReportSchema,
  GuestListReportSchema,
  GuestListItemSchema,
  type PerformanceReport,
  type OccupancyReport,
  type RevenueKpiReport,
  type GuestListReport,
};

// Backward compatibility alias
export const ReservationSourceSchema = ReservationSourceSummarySchema;

type ReservationStatusRow = {
  status: string | null;
  count: string | number | null;
};

type RevenueSummaryRow = {
  revenue_today: string | number | null;
  revenue_month: string | number | null;
  revenue_year: string | number | null;
};

type ReservationSourceRow = {
  source: string | null;
  reservations: string | number | null;
  total_amount: string | number | null;
};

const normalizeStatusKey = (value: string | null): keyof ReservationStatusSummary | null => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const key = value.toLowerCase();
  switch (key) {
    case "confirmed":
    case "pending":
    case "checked_in":
    case "checked_out":
    case "cancelled":
    case "no_show":
      return key;
    default:
      return null;
  }
};

const normalizeSource = (value: string | null): string => {
  if (!value || typeof value !== "string") {
    return "unknown";
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Build a performance report for reservations and revenue.
 */
export const getPerformanceReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PerformanceReport> => {
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const startDate = options.startDate ?? null;
  const endDate = options.endDate ?? null;

  const [statusResult, revenueResult, sourcesResult] = await Promise.all([
    query<ReservationStatusRow>(RESERVATION_STATUS_SUMMARY_SQL, [
      tenantId,
      propertyId,
      startDate,
      endDate,
    ]),
    query<RevenueSummaryRow>(REVENUE_SUMMARY_SQL, [tenantId, propertyId]),
    query<ReservationSourceRow>(RESERVATION_SOURCE_SUMMARY_SQL, [
      tenantId,
      propertyId,
      startDate,
      endDate,
    ]),
  ]);

  const statusSummary = {
    confirmed: 0,
    pending: 0,
    checked_in: 0,
    checked_out: 0,
    cancelled: 0,
    no_show: 0,
  };

  for (const row of statusResult.rows) {
    const key = normalizeStatusKey(row.status);
    if (!key) {
      continue;
    }
    statusSummary[key] = (statusSummary[key] ?? 0) + toNonNegativeInt(row.count, 0);
  }

  const revenueRow = revenueResult.rows.at(0);
  const revenueSummary = {
    today: toNumberOrFallback(revenueRow?.revenue_today, 0),
    monthToDate: toNumberOrFallback(revenueRow?.revenue_month, 0),
    yearToDate: toNumberOrFallback(revenueRow?.revenue_year, 0),
    currency: "USD",
  };

  const topSources = sourcesResult.rows.map((row) =>
    ReservationSourceSchema.parse({
      source: normalizeSource(row.source),
      reservations: toNonNegativeInt(row.reservations, 0),
      total_amount: toNumberOrFallback(row.total_amount, 0),
    }),
  );

  return PerformanceReportSchema.parse({
    statusSummary,
    revenueSummary,
    topSources,
  });
};

// ─── S24: Occupancy Report ───────────────────────────────────────────────────

type OccupancyRow = {
  date: string;
  total_rooms: number | string;
  rooms_sold: number | string;
  rooms_available: number | string;
  occupancy_pct: number | string;
};

/**
 * Build an occupancy report for a date range.
 */
export const getOccupancyReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<OccupancyReport> => {
  const result = await query<OccupancyRow>(OCCUPANCY_REPORT_SQL, [
    options.tenantId,
    options.propertyId ?? null,
    options.startDate,
    options.endDate,
  ]);

  const days = result.rows.map((row) => ({
    date: row.date,
    total_rooms: toNonNegativeInt(row.total_rooms, 0),
    rooms_sold: toNonNegativeInt(row.rooms_sold, 0),
    rooms_available: toNonNegativeInt(row.rooms_available, 0),
    occupancy_pct: toNumberOrFallback(row.occupancy_pct, 0),
  }));

  const totalRoomNights = days.reduce((sum, d) => sum + d.total_rooms, 0);
  const roomsSold = days.reduce((sum, d) => sum + d.rooms_sold, 0);
  const avgOccupancy =
    totalRoomNights > 0 ? Math.round((roomsSold / totalRoomNights) * 10000) / 100 : 0;

  return OccupancyReportSchema.parse({
    summary: {
      total_room_nights: totalRoomNights,
      rooms_sold: roomsSold,
      avg_occupancy_pct: avgOccupancy,
    },
    days,
  });
};

// ─── S24: Revenue KPI Report ────────────────────────────────────────────────

type RevenueKpiRow = {
  total_room_revenue: string | number;
  total_revenue: string | number;
  rooms_sold: string | number;
  available_room_nights: string | number;
  occupancy_pct: string | number;
  adr: string | number;
  revpar: string | number;
  trevpar: string | number;
};

/**
 * Build revenue KPIs (ADR, RevPAR, TRevPAR) for a date range.
 */
export const getRevenueKpiReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<RevenueKpiReport> => {
  const result = await query<RevenueKpiRow>(REVENUE_KPI_SQL, [
    options.tenantId,
    options.propertyId ?? null,
    options.startDate,
    options.endDate,
  ]);

  const row = result.rows[0];

  return RevenueKpiReportSchema.parse({
    period_start: options.startDate,
    period_end: options.endDate,
    total_room_revenue: toNumberOrFallback(row?.total_room_revenue, 0),
    total_revenue: toNumberOrFallback(row?.total_revenue, 0),
    rooms_sold: toNonNegativeInt(row?.rooms_sold, 0),
    available_room_nights: toNonNegativeInt(row?.available_room_nights, 0),
    occupancy_pct: toNumberOrFallback(row?.occupancy_pct, 0),
    adr: toNumberOrFallback(row?.adr, 0),
    revpar: toNumberOrFallback(row?.revpar, 0),
    trevpar: toNumberOrFallback(row?.trevpar, 0),
    currency: "USD",
  });
};

// ─── S24: Guest Lists (Arrivals / Departures / In-House) ────────────────────

type GuestListRow = {
  reservation_id: string;
  confirmation_number: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  room_number: string | null;
  room_type: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  source: string | null;
  special_requests: string | null;
  eta: string | null;
  number_of_adults: number | string | null;
  number_of_children: number | string | null;
  vip: boolean;
};

const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 500;

const parseGuestListRows = (rows: GuestListRow[]): GuestListReport["items"] =>
  rows.map((row) =>
    GuestListItemSchema.parse({
      reservation_id: row.reservation_id,
      confirmation_number: row.confirmation_number,
      guest_name: row.guest_name,
      guest_email: row.guest_email ?? undefined,
      guest_phone: row.guest_phone,
      room_number: row.room_number,
      room_type: row.room_type ?? undefined,
      check_in_date: row.check_in_date,
      check_out_date: row.check_out_date,
      status: row.status,
      source: row.source ?? undefined,
      special_requests: row.special_requests,
      eta: row.eta,
      number_of_adults: toNonNegativeInt(row.number_of_adults, 0),
      number_of_children: toNonNegativeInt(row.number_of_children, 0),
      vip: row.vip ?? false,
    }),
  );

const clampLimit = (value?: number): number =>
  Math.min(Math.max(value ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);

/**
 * Get the arrivals list for a date range.
 */
export const getArrivalsReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
  limit?: number;
  offset?: number;
}): Promise<GuestListReport> => {
  const limit = clampLimit(options.limit);
  const offset = Math.max(options.offset ?? 0, 0);
  const params = [options.tenantId, options.propertyId ?? null, options.startDate, options.endDate];

  const [countResult, listResult] = await Promise.all([
    query<{ total: string | number }>(ARRIVALS_COUNT_SQL, params),
    query<GuestListRow>(ARRIVALS_LIST_SQL, [...params, limit, offset]),
  ]);

  return GuestListReportSchema.parse({
    total: toNonNegativeInt(countResult.rows[0]?.total, 0),
    items: parseGuestListRows(listResult.rows),
  });
};

/**
 * Get the departures list for a date range.
 */
export const getDeparturesReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
  limit?: number;
  offset?: number;
}): Promise<GuestListReport> => {
  const limit = clampLimit(options.limit);
  const offset = Math.max(options.offset ?? 0, 0);
  const params = [options.tenantId, options.propertyId ?? null, options.startDate, options.endDate];

  const [countResult, listResult] = await Promise.all([
    query<{ total: string | number }>(DEPARTURES_COUNT_SQL, params),
    query<GuestListRow>(DEPARTURES_LIST_SQL, [...params, limit, offset]),
  ]);

  return GuestListReportSchema.parse({
    total: toNonNegativeInt(countResult.rows[0]?.total, 0),
    items: parseGuestListRows(listResult.rows),
  });
};

/**
 * Get the in-house guest list (currently checked-in).
 */
export const getInHouseReport = async (options: {
  tenantId: string;
  propertyId?: string;
  limit?: number;
  offset?: number;
}): Promise<GuestListReport> => {
  const limit = clampLimit(options.limit);
  const offset = Math.max(options.offset ?? 0, 0);
  const params = [options.tenantId, options.propertyId ?? null];

  const [countResult, listResult] = await Promise.all([
    query<{ total: string | number }>(IN_HOUSE_COUNT_SQL, params),
    query<GuestListRow>(IN_HOUSE_LIST_SQL, [...params, limit, offset]),
  ]);

  return GuestListReportSchema.parse({
    total: toNonNegativeInt(countResult.rows[0]?.total, 0),
    items: parseGuestListRows(listResult.rows),
  });
};

// ─── S13: Revenue Reports — Demand Forecast, Pace, Revenue Forecast ─────────

// Re-export schemas from @tartware/schemas for consumers
export {
  DemandForecastReportSchema,
  type DemandForecastReport,
  PaceReportSchema,
  type PaceReport,
  RevenueForecastReportSchema,
  type RevenueForecastReport,
};

/**
 * Get demand forecast from the demand_calendar table.
 */
export const getDemandForecastReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<DemandForecastReport> => {
  const { rows } = await query<Record<string, unknown>>(
    `SELECT calendar_date::text, demand_level, demand_score,
            COALESCE(occupancy_percent, 0) AS occupancy_percent,
            COALESCE(forecasted_occupancy_percent, 0) AS forecasted_occupancy_percent,
            COALESCE(adr, 0) AS adr,
            COALESCE(forecasted_adr, 0) AS forecasted_adr,
            COALESCE(revpar, 0) AS revpar,
            COALESCE(forecasted_revpar, 0) AS forecasted_revpar,
            COALESCE(rooms_available, 0) AS rooms_available,
            COALESCE(rooms_occupied, 0) AS rooms_occupied,
            COALESCE(rooms_remaining, 0) AS rooms_remaining,
            booking_pace, recommended_pricing_strategy, season
     FROM demand_calendar
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND calendar_date >= $3::date AND calendar_date <= $4::date
     ORDER BY calendar_date`,
    [options.tenantId, options.propertyId ?? null, options.startDate, options.endDate],
  );

  const days = rows.map((r) => ({
    calendar_date: String(r.calendar_date),
    demand_level: String(r.demand_level ?? "unknown"),
    demand_score: Number(r.demand_score ?? 0),
    occupancy_percent: Number(r.occupancy_percent),
    forecasted_occupancy_percent: Number(r.forecasted_occupancy_percent),
    adr: Number(r.adr),
    forecasted_adr: Number(r.forecasted_adr),
    revpar: Number(r.revpar),
    forecasted_revpar: Number(r.forecasted_revpar),
    rooms_available: Number(r.rooms_available),
    rooms_occupied: Number(r.rooms_occupied),
    rooms_remaining: Number(r.rooms_remaining),
    booking_pace: r.booking_pace ? String(r.booking_pace) : null,
    recommended_pricing_strategy: r.recommended_pricing_strategy
      ? String(r.recommended_pricing_strategy)
      : null,
    season: r.season ? String(r.season) : null,
  }));

  const total = days.length || 1;
  return DemandForecastReportSchema.parse({
    days,
    summary: {
      total_days: days.length,
      avg_demand_score: days.reduce((s, d) => s + d.demand_score, 0) / total,
      avg_occupancy: days.reduce((s, d) => s + d.occupancy_percent, 0) / total,
      avg_forecasted_occupancy:
        days.reduce((s, d) => s + d.forecasted_occupancy_percent, 0) / total,
      avg_adr: days.reduce((s, d) => s + d.adr, 0) / total,
      avg_revpar: days.reduce((s, d) => s + d.revpar, 0) / total,
    },
  });
};

/**
 * Get booking pace report from the demand_calendar table.
 */
export const getPaceReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<PaceReport> => {
  const { rows } = await query<Record<string, unknown>>(
    `SELECT calendar_date::text, booking_pace,
            COALESCE(pace_vs_last_year, 0) AS pace_vs_last_year,
            COALESCE(pace_vs_budget, 0) AS pace_vs_budget,
            COALESCE(pickup_last_7_days, 0) AS pickup_last_7_days,
            COALESCE(pickup_last_30_days, 0) AS pickup_last_30_days,
            COALESCE(total_bookings, 0) AS total_bookings,
            COALESCE(new_bookings_today, 0) AS new_bookings_today,
            COALESCE(cancellations_today, 0) AS cancellations_today,
            COALESCE(occupancy_percent, 0) AS occupancy_percent,
            COALESCE(same_day_last_year_occupancy, 0) AS same_day_last_year_occupancy,
            COALESCE(variance_vs_last_year_occupancy, 0) AS variance_vs_last_year_occupancy
     FROM demand_calendar
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND calendar_date >= $3::date AND calendar_date <= $4::date
     ORDER BY calendar_date`,
    [options.tenantId, options.propertyId ?? null, options.startDate, options.endDate],
  );

  const days = rows.map((r) => ({
    calendar_date: String(r.calendar_date),
    booking_pace: r.booking_pace ? String(r.booking_pace) : null,
    pace_vs_last_year: Number(r.pace_vs_last_year),
    pace_vs_budget: Number(r.pace_vs_budget),
    pickup_last_7_days: Number(r.pickup_last_7_days),
    pickup_last_30_days: Number(r.pickup_last_30_days),
    total_bookings: Number(r.total_bookings),
    new_bookings_today: Number(r.new_bookings_today),
    cancellations_today: Number(r.cancellations_today),
    occupancy_percent: Number(r.occupancy_percent),
    same_day_last_year_occupancy: Number(r.same_day_last_year_occupancy),
    variance_vs_last_year_occupancy: Number(r.variance_vs_last_year_occupancy),
  }));

  const total = days.length || 1;
  return PaceReportSchema.parse({
    days,
    summary: {
      total_days: days.length,
      avg_pace_vs_last_year: days.reduce((s, d) => s + d.pace_vs_last_year, 0) / total,
      total_pickup_7d: days.reduce((s, d) => s + d.pickup_last_7_days, 0),
      total_pickup_30d: days.reduce((s, d) => s + d.pickup_last_30_days, 0),
      total_new_bookings: days.reduce((s, d) => s + d.new_bookings_today, 0),
      total_cancellations: days.reduce((s, d) => s + d.cancellations_today, 0),
    },
  });
};

/**
 * Get revenue forecasts from the revenue_forecasts table.
 */
export const getRevenueForecastReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
  scenario?: string;
  limit?: number;
  offset?: number;
}): Promise<RevenueForecastReport> => {
  const limit = clampLimit(options.limit);
  const offset = Math.max(options.offset ?? 0, 0);

  const { rows: countResult } = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM revenue_forecasts
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND forecast_date >= $3::date AND forecast_date <= $4::date
       AND ($5::text IS NULL OR forecast_scenario = $5::text)`,
    [
      options.tenantId,
      options.propertyId ?? null,
      options.startDate,
      options.endDate,
      options.scenario ?? null,
    ],
  );

  const { rows } = await query<Record<string, unknown>>(
    `SELECT forecast_date::text, forecast_period, forecast_type, forecast_scenario,
            COALESCE(forecasted_value, 0) AS forecasted_value,
            COALESCE(confidence_level, 0) AS confidence_level,
            confidence_interval_low, confidence_interval_high,
            actual_value,
            variance_percent,
            COALESCE(room_revenue_forecast, 0) AS room_revenue_forecast,
            COALESCE(fb_revenue_forecast, 0) AS fb_revenue_forecast,
            COALESCE(other_revenue_forecast, 0) AS other_revenue_forecast,
            COALESCE(total_revenue_forecast, 0) AS total_revenue_forecast,
            COALESCE(forecasted_occupancy_percent, 0) AS forecasted_occupancy_percent,
            COALESCE(forecasted_adr, 0) AS forecasted_adr,
            COALESCE(forecasted_revpar, 0) AS forecasted_revpar,
            COALESCE(review_status, 'draft') AS review_status
     FROM revenue_forecasts
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND forecast_date >= $3::date AND forecast_date <= $4::date
       AND ($5::text IS NULL OR forecast_scenario = $5::text)
     ORDER BY forecast_date, forecast_type
     LIMIT $6 OFFSET $7`,
    [
      options.tenantId,
      options.propertyId ?? null,
      options.startDate,
      options.endDate,
      options.scenario ?? null,
      limit,
      offset,
    ],
  );

  return RevenueForecastReportSchema.parse({
    forecasts: rows.map((r) => ({
      forecast_date: String(r.forecast_date),
      forecast_period: String(r.forecast_period),
      forecast_type: String(r.forecast_type),
      forecast_scenario: String(r.forecast_scenario),
      forecasted_value: Number(r.forecasted_value),
      confidence_level: Number(r.confidence_level),
      confidence_interval_low:
        r.confidence_interval_low != null ? Number(r.confidence_interval_low) : null,
      confidence_interval_high:
        r.confidence_interval_high != null ? Number(r.confidence_interval_high) : null,
      actual_value: r.actual_value != null ? Number(r.actual_value) : null,
      variance_percent: r.variance_percent != null ? Number(r.variance_percent) : null,
      room_revenue_forecast: Number(r.room_revenue_forecast),
      fb_revenue_forecast: Number(r.fb_revenue_forecast),
      other_revenue_forecast: Number(r.other_revenue_forecast),
      total_revenue_forecast: Number(r.total_revenue_forecast),
      forecasted_occupancy_percent: Number(r.forecasted_occupancy_percent),
      forecasted_adr: Number(r.forecasted_adr),
      forecasted_revpar: Number(r.forecasted_revpar),
      review_status: String(r.review_status),
    })),
    total: toNonNegativeInt(countResult[0]?.total, 0),
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// Manager's Flash Report
// ──────────────────────────────────────────────────────────────────────────────

export type FlashReportData = {
  business_date: string;
  rooms: {
    total: number;
    sold: number;
    available: number;
    out_of_order: number;
    out_of_service: number;
    complimentary: number;
    occupancy_percent: number;
  };
  revenue: {
    room_revenue: number;
    total_revenue: number;
    adr: number;
    revpar: number;
    currency: string;
  };
  arrivals: {
    due_in: number;
    checked_in: number;
    vip_arrivals: number;
    group_arrivals: number;
  };
  departures: {
    due_out: number;
    checked_out: number;
    late_checkouts: number;
  };
  in_house: {
    total_guests: number;
    no_shows_today: number;
    walk_ins_today: number;
  };
  housekeeping: {
    dirty: number;
    clean: number;
    inspected: number;
    in_progress: number;
  };
  maintenance: {
    open_requests: number;
    urgent_or_emergency: number;
    completed_today: number;
  };
};

/**
 * Generate a Manager's Flash Report — a real-time operational snapshot.
 */
export const getFlashReport = async (params: {
  tenantId: string;
  propertyId?: string;
  businessDate?: string;
}): Promise<FlashReportData> => {
  const baseParams: unknown[] = [params.tenantId];
  const hasProperty = Boolean(params.propertyId);
  if (hasProperty) baseParams.push(params.propertyId);
  if (params.businessDate) baseParams.push(params.businessDate);

  const propFilter = hasProperty ? "AND property_id = $2" : "";
  const dateIdx = hasProperty ? (params.businessDate ? "$3" : "") : params.businessDate ? "$2" : "";
  const dateSql = params.businessDate ? `${dateIdx}::date` : "CURRENT_DATE";

  // Total rooms
  const roomsRes = await query<{ total: string; ooo: string; oos: string }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'OUT_OF_ORDER') AS ooo,
       COUNT(*) FILTER (WHERE status = 'OUT_OF_SERVICE') AS oos
     FROM rooms
     WHERE tenant_id = $1 ${propFilter} AND is_deleted = false`,
    baseParams.slice(0, hasProperty ? 2 : 1),
  );
  const totalRooms = parseInt(roomsRes.rows[0]?.total ?? "0", 10);
  const ooo = parseInt(roomsRes.rows[0]?.ooo ?? "0", 10);
  const oos = parseInt(roomsRes.rows[0]?.oos ?? "0", 10);

  // Reservations snapshot
  const qParams = params.businessDate ? [...baseParams] : baseParams.slice(0, hasProperty ? 2 : 1);

  const reservesRes = await query<{
    sold: string;
    comp: string;
    due_in: string;
    checked_in: string;
    vip_arrivals: string;
    group_arrivals: string;
    due_out: string;
    checked_out: string;
    in_house: string;
    no_shows: string;
    walk_ins: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE status IN ('CONFIRMED','CHECKED_IN')
           AND check_in_date <= ${dateSql} AND check_out_date > ${dateSql}
       ) AS sold,
       COUNT(*) FILTER (
         WHERE status IN ('CONFIRMED','CHECKED_IN')
           AND check_in_date <= ${dateSql} AND check_out_date > ${dateSql}
           AND COALESCE((metadata->>'complimentary')::boolean, false) = true
       ) AS comp,
       COUNT(*) FILTER (
         WHERE check_in_date = ${dateSql} AND status = 'CONFIRMED'
       ) AS due_in,
       COUNT(*) FILTER (
         WHERE check_in_date = ${dateSql} AND status = 'CHECKED_IN'
       ) AS checked_in,
       COUNT(*) FILTER (
         WHERE check_in_date = ${dateSql} AND status IN ('CONFIRMED','CHECKED_IN')
           AND COALESCE((metadata->>'vip')::boolean, false) = true
       ) AS vip_arrivals,
       COUNT(*) FILTER (
         WHERE check_in_date = ${dateSql} AND status IN ('CONFIRMED','CHECKED_IN')
           AND group_id IS NOT NULL
       ) AS group_arrivals,
       COUNT(*) FILTER (
         WHERE check_out_date = ${dateSql} AND status = 'CHECKED_IN'
       ) AS due_out,
       COUNT(*) FILTER (
         WHERE check_out_date = ${dateSql} AND status = 'CHECKED_OUT'
       ) AS checked_out,
       COUNT(*) FILTER (
         WHERE status = 'CHECKED_IN'
       ) AS in_house,
       COUNT(*) FILTER (
         WHERE check_in_date = ${dateSql} AND status = 'NO_SHOW'
       ) AS no_shows,
       COUNT(*) FILTER (
         WHERE check_in_date = ${dateSql}
           AND COALESCE((metadata->>'walk_in')::boolean, false) = true
       ) AS walk_ins
     FROM reservations
     WHERE tenant_id = $1 ${propFilter} AND is_deleted = false`,
    qParams,
  );
  const r = reservesRes.rows[0]!;
  const sold = parseInt(r.sold, 10);
  const comp = parseInt(r.comp, 10);
  const available = Math.max(0, totalRooms - sold - ooo - oos);
  const occupancyPct = totalRooms > 0 ? Math.round((sold / totalRooms) * 100) : 0;

  // Revenue
  const revenueRes = await query<{ room_rev: string; total_rev: string }>(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE charge_code IN ('ROOM','ROOM_CHARGE','room_charge')), 0) AS room_rev,
       COALESCE(SUM(amount), 0) AS total_rev
     FROM charges
     WHERE tenant_id = $1 ${propFilter}
       AND DATE(posted_at) = ${dateSql}
       AND COALESCE(is_voided, false) = false
       AND COALESCE(is_deleted, false) = false`,
    qParams,
  );
  const roomRevenue = parseFloat(revenueRes.rows[0]?.room_rev ?? "0");
  const totalRevenue = parseFloat(revenueRes.rows[0]?.total_rev ?? "0");
  const adr = sold > 0 ? Math.round((roomRevenue / sold) * 100) / 100 : 0;
  const revpar = totalRooms > 0 ? Math.round((roomRevenue / totalRooms) * 100) / 100 : 0;

  // Late checkouts (past checkout time but still CHECKED_IN)
  const lateRes = await query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt
     FROM reservations
     WHERE tenant_id = $1 ${propFilter} AND is_deleted = false
       AND check_out_date = ${dateSql}
       AND status = 'CHECKED_IN'
       AND NOW()::time > '12:00:00'`,
    qParams,
  );
  const lateCheckouts = parseInt(lateRes.rows[0]?.cnt ?? "0", 10);

  // Housekeeping
  const hkRes = await query<{
    dirty: string;
    clean: string;
    inspected: string;
    in_progress: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'DIRTY') AS dirty,
       COUNT(*) FILTER (WHERE status = 'CLEAN') AS clean,
       COUNT(*) FILTER (WHERE status = 'INSPECTED') AS inspected,
       COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress
     FROM housekeeping_tasks
     WHERE tenant_id = $1 ${propFilter}
       AND scheduled_date = ${dateSql}
       AND COALESCE(is_deleted, false) = false`,
    qParams,
  );
  const hk = hkRes.rows[0]!;

  // Maintenance
  const maintRes = await query<{ open_req: string; urgent: string; completed: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE request_status IN ('OPEN','ASSIGNED','IN_PROGRESS','ON_HOLD')) AS open_req,
       COUNT(*) FILTER (WHERE request_status IN ('OPEN','ASSIGNED','IN_PROGRESS') AND priority IN ('URGENT','EMERGENCY')) AS urgent,
       COUNT(*) FILTER (WHERE request_status = 'COMPLETED' AND DATE(completed_at) = ${dateSql}) AS completed
     FROM maintenance_requests
     WHERE tenant_id = $1 ${propFilter} AND is_deleted = false`,
    qParams,
  );
  const mt = maintRes.rows[0]!;

  return {
    business_date: params.businessDate ?? new Date().toISOString().slice(0, 10),
    rooms: {
      total: totalRooms,
      sold,
      available,
      out_of_order: ooo,
      out_of_service: oos,
      complimentary: comp,
      occupancy_percent: occupancyPct,
    },
    revenue: {
      room_revenue: roomRevenue,
      total_revenue: totalRevenue,
      adr,
      revpar,
      currency: "USD",
    },
    arrivals: {
      due_in: parseInt(r.due_in, 10),
      checked_in: parseInt(r.checked_in, 10),
      vip_arrivals: parseInt(r.vip_arrivals, 10),
      group_arrivals: parseInt(r.group_arrivals, 10),
    },
    departures: {
      due_out: parseInt(r.due_out, 10),
      checked_out: parseInt(r.checked_out, 10),
      late_checkouts: lateCheckouts,
    },
    in_house: {
      total_guests: parseInt(r.in_house, 10),
      no_shows_today: parseInt(r.no_shows, 10),
      walk_ins_today: parseInt(r.walk_ins, 10),
    },
    housekeeping: {
      dirty: parseInt(hk.dirty, 10),
      clean: parseInt(hk.clean, 10),
      inspected: parseInt(hk.inspected, 10),
      in_progress: parseInt(hk.in_progress, 10),
    },
    maintenance: {
      open_requests: parseInt(mt.open_req, 10),
      urgent_or_emergency: parseInt(mt.urgent, 10),
      completed_today: parseInt(mt.completed, 10),
    },
  };
};

// ─── CG-14: No-Show Report ──────────────────────────────────────────────────

export type NoShowReportItem = {
  reservation_id: string;
  confirmation_number: string;
  guest_name: string;
  room_type: string | null;
  room_number: string | null;
  check_in_date: string;
  check_out_date: string;
  source: string | null;
  total_amount: number;
  deposit_amount: number;
};

/**
 * List reservations that were marked as no-show within a date range.
 */
export const getNoShowReport = async (params: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: NoShowReportItem[] }> => {
  const baseParams = [params.tenantId, params.propertyId ?? null, params.startDate, params.endDate];

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM reservations
     WHERE tenant_id = $1::uuid AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND check_in_date >= $3::date AND check_in_date <= $4::date
       AND status = 'NO_SHOW'`,
    baseParams,
  );

  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const offset = Math.max(params.offset ?? 0, 0);

  const { rows } = await query<{
    reservation_id: string;
    confirmation_number: string;
    guest_name: string;
    room_type: string | null;
    room_number: string | null;
    check_in_date: string;
    check_out_date: string;
    source: string | null;
    total_amount: string;
    deposit_amount: string;
  }>(
    `SELECT r.id AS reservation_id,
            r.confirmation_number,
            COALESCE(g.first_name || ' ' || g.last_name, 'Unknown') AS guest_name,
            r.room_type,
            r.room_number,
            r.check_in_date::text,
            r.check_out_date::text,
            r.source,
            COALESCE(r.total_amount, 0)::text AS total_amount,
            COALESCE(r.deposit_amount, 0)::text AS deposit_amount
     FROM reservations r
     LEFT JOIN guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
       AND r.check_in_date >= $3::date AND r.check_in_date <= $4::date
       AND r.status = 'NO_SHOW'
     ORDER BY r.check_in_date, r.confirmation_number
     LIMIT $5 OFFSET $6`,
    [...baseParams, limit, offset],
  );

  return {
    total: parseInt(countResult.rows[0]?.total ?? "0", 10),
    items: rows.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount),
      deposit_amount: Number(row.deposit_amount),
    })),
  };
};

// ─── CG-14: VIP Arrivals Report ─────────────────────────────────────────────

/**
 * List VIP guest arrivals for a date range.
 */
export const getVipArrivalsReport = async (params: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
  limit?: number;
  offset?: number;
}): Promise<GuestListReport> => {
  const baseParams = [params.tenantId, params.propertyId ?? null, params.startDate, params.endDate];

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
       AND r.check_in_date >= $3::date AND r.check_in_date <= $4::date
       AND r.status IN ('CONFIRMED', 'CHECKED_IN')
       AND g.vip_status = true`,
    baseParams,
  );

  const limit = clampLimit(params.limit);
  const offset = Math.max(params.offset ?? 0, 0);

  const { rows } = await query<GuestListRow>(
    `SELECT r.id AS reservation_id,
            r.confirmation_number,
            COALESCE(g.first_name || ' ' || g.last_name, 'Unknown') AS guest_name,
            g.email AS guest_email,
            g.phone AS guest_phone,
            r.room_number,
            r.room_type,
            r.check_in_date::text,
            r.check_out_date::text,
            r.status,
            r.source,
            r.special_requests,
            r.eta,
            r.number_of_adults,
            r.number_of_children,
            true AS vip
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
       AND r.check_in_date >= $3::date AND r.check_in_date <= $4::date
       AND r.status IN ('CONFIRMED', 'CHECKED_IN')
       AND g.vip_status = true
     ORDER BY r.check_in_date, g.last_name
     LIMIT $5 OFFSET $6`,
    [...baseParams, limit, offset],
  );

  return GuestListReportSchema.parse({
    total: parseInt(countResult.rows[0]?.total ?? "0", 10),
    items: parseGuestListRows(rows),
  });
};

// ─── CG-14: Guest Statistics Report ─────────────────────────────────────────

export type GuestStatisticsReport = {
  total_guests: number;
  new_guests_period: number;
  returning_guests: number;
  vip_count: number;
  nationality_breakdown: Array<{ nationality: string; count: number }>;
  loyalty_tier_breakdown: Array<{ tier: string; count: number }>;
};

/**
 * Aggregate guest demographics and statistics for the property.
 */
export const getGuestStatisticsReport = async (params: {
  tenantId: string;
  propertyId?: string;
}): Promise<GuestStatisticsReport> => {
  const { tenantId } = params;

  const totals = await query<{
    total: string;
    vip: string;
  }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE vip_status = true)::text AS vip
     FROM guests WHERE tenant_id = $1::uuid AND is_deleted = false`,
    [tenantId],
  );

  const returning = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT guest_id)::text AS count
     FROM reservations
     WHERE tenant_id = $1::uuid AND status IN ('CHECKED_IN','CHECKED_OUT')
     GROUP BY guest_id HAVING COUNT(*) > 1`,
    [tenantId],
  );

  const nationalities = await query<{ nationality: string; count: string }>(
    `SELECT COALESCE(nationality, 'Unknown') AS nationality, COUNT(*)::text AS count
     FROM guests WHERE tenant_id = $1::uuid AND is_deleted = false
     GROUP BY nationality ORDER BY COUNT(*) DESC LIMIT 20`,
    [tenantId],
  );

  const tiers = await query<{ tier: string; count: string }>(
    `SELECT COALESCE(loyalty_tier, 'NONE') AS tier, COUNT(*)::text AS count
     FROM guests WHERE tenant_id = $1::uuid AND is_deleted = false
     GROUP BY loyalty_tier ORDER BY COUNT(*) DESC`,
    [tenantId],
  );

  return {
    total_guests: parseInt(totals.rows[0]?.total ?? "0", 10),
    new_guests_period: 0,
    returning_guests: returning.rows.length,
    vip_count: parseInt(totals.rows[0]?.vip ?? "0", 10),
    nationality_breakdown: nationalities.rows.map((r) => ({
      nationality: r.nationality,
      count: parseInt(r.count, 10),
    })),
    loyalty_tier_breakdown: tiers.rows.map((r) => ({
      tier: r.tier,
      count: parseInt(r.count, 10),
    })),
  };
};

// ─── CG-14: Market Segment Production Report ────────────────────────────────

export type MarketSegmentProductionItem = {
  market_segment: string;
  room_nights: number;
  revenue: number;
  avg_rate: number;
  percentage_of_total: number;
};

/**
 * Revenue and room-night production by market segment.
 */
export const getMarketSegmentProductionReport = async (params: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<{
  items: MarketSegmentProductionItem[];
  total_room_nights: number;
  total_revenue: number;
}> => {
  const { rows } = await query<{
    market_segment: string;
    room_nights: string;
    revenue: string;
    avg_rate: string;
  }>(
    `SELECT
       COALESCE(r.market_segment, 'UNCLASSIFIED') AS market_segment,
       COUNT(*)::text AS room_nights,
       COALESCE(SUM(r.total_amount), 0)::text AS revenue,
       CASE WHEN COUNT(*) > 0 THEN (SUM(r.total_amount) / COUNT(*))::text ELSE '0' END AS avg_rate
     FROM reservations r
     WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
       AND r.check_in_date >= $3::date AND r.check_in_date <= $4::date
       AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
     GROUP BY COALESCE(r.market_segment, 'UNCLASSIFIED')
     ORDER BY SUM(r.total_amount) DESC`,
    [params.tenantId, params.propertyId ?? null, params.startDate, params.endDate],
  );

  const totalNights = rows.reduce((s, r) => s + parseInt(r.room_nights, 10), 0);
  const totalRev = rows.reduce((s, r) => s + Number(r.revenue), 0);

  return {
    total_room_nights: totalNights,
    total_revenue: Math.round(totalRev * 100) / 100,
    items: rows.map((r) => ({
      market_segment: r.market_segment,
      room_nights: parseInt(r.room_nights, 10),
      revenue: Math.round(Number(r.revenue) * 100) / 100,
      avg_rate: Math.round(Number(r.avg_rate) * 100) / 100,
      percentage_of_total:
        totalNights > 0 ? Math.round((parseInt(r.room_nights, 10) / totalNights) * 10000) / 100 : 0,
    })),
  };
};

// ─── CG-14: Housekeeping Productivity Report ────────────────────────────────

export type HousekeepingProductivityReport = {
  total_tasks: number;
  completed: number;
  in_progress: number;
  pending: number;
  completion_rate: number;
  avg_duration_minutes: number;
  by_attendant: Array<{
    attendant_id: string;
    attendant_name: string;
    completed_tasks: number;
    avg_duration_minutes: number;
  }>;
};

/**
 * Housekeeping task productivity statistics for a business date.
 */
export const getHousekeepingProductivityReport = async (params: {
  tenantId: string;
  propertyId?: string;
  businessDate: string;
}): Promise<HousekeepingProductivityReport> => {
  const qParams = [params.tenantId, params.propertyId ?? null, params.businessDate];

  const summary = await query<{
    total: string;
    completed: string;
    in_progress: string;
    pending: string;
    avg_minutes: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE task_status IN ('COMPLETED', 'INSPECTED'))::text AS completed,
       COUNT(*) FILTER (WHERE task_status = 'IN_PROGRESS')::text AS in_progress,
       COUNT(*) FILTER (WHERE task_status IN ('PENDING', 'ASSIGNED'))::text AS pending,
       COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)
         FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL), 0)::text AS avg_minutes
     FROM housekeeping_tasks
     WHERE tenant_id = $1::uuid AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND scheduled_date = $3::date`,
    qParams,
  );

  const byAttendant = await query<{
    attendant_id: string;
    attendant_name: string;
    completed_tasks: string;
    avg_dur: string;
  }>(
    `SELECT
       ht.assigned_to AS attendant_id,
       COALESCE(u.display_name, u.username, ht.assigned_to::text) AS attendant_name,
       COUNT(*)::text AS completed_tasks,
       COALESCE(AVG(EXTRACT(EPOCH FROM (ht.completed_at - ht.started_at)) / 60), 0)::text AS avg_dur
     FROM housekeeping_tasks ht
     LEFT JOIN users u ON u.id = ht.assigned_to AND u.tenant_id = ht.tenant_id
     WHERE ht.tenant_id = $1::uuid AND ($2::uuid IS NULL OR ht.property_id = $2::uuid)
       AND ht.scheduled_date = $3::date
       AND ht.task_status IN ('COMPLETED', 'INSPECTED')
       AND ht.assigned_to IS NOT NULL
     GROUP BY ht.assigned_to, u.display_name, u.username
     ORDER BY COUNT(*) DESC
     LIMIT 50`,
    qParams,
  );

  const s = summary.rows[0]!;
  const total = parseInt(s.total, 10);
  const completed = parseInt(s.completed, 10);

  return {
    total_tasks: total,
    completed,
    in_progress: parseInt(s.in_progress, 10),
    pending: parseInt(s.pending, 10),
    completion_rate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
    avg_duration_minutes: Math.round(Number(s.avg_minutes) * 100) / 100,
    by_attendant: byAttendant.rows.map((r) => ({
      attendant_id: r.attendant_id,
      attendant_name: r.attendant_name,
      completed_tasks: parseInt(r.completed_tasks, 10),
      avg_duration_minutes: Math.round(Number(r.avg_dur) * 100) / 100,
    })),
  };
};

// ─── CG-14: Maintenance SLA Report ──────────────────────────────────────────

export type MaintenanceSlaReport = {
  total_requests: number;
  completed: number;
  overdue: number;
  avg_response_time_minutes: number;
  avg_resolution_time_hours: number;
  by_priority: Array<{
    priority: string;
    count: number;
    completed: number;
    avg_resolution_hours: number;
  }>;
};

/**
 * Maintenance request SLA compliance and resolution metrics.
 */
export const getMaintenanceSlaReport = async (params: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<MaintenanceSlaReport> => {
  const qParams = [params.tenantId, params.propertyId ?? null, params.startDate, params.endDate];

  const summary = await query<{
    total: string;
    completed: string;
    overdue: string;
    avg_response: string;
    avg_resolution: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE request_status = 'COMPLETED')::text AS completed,
       COUNT(*) FILTER (WHERE request_status NOT IN ('COMPLETED','CANCELLED') AND scheduled_date < CURRENT_DATE)::text AS overdue,
       COALESCE(AVG(response_time_minutes) FILTER (WHERE response_time_minutes IS NOT NULL), 0)::text AS avg_response,
       COALESCE(AVG(resolution_time_hours) FILTER (WHERE resolution_time_hours IS NOT NULL), 0)::text AS avg_resolution
     FROM maintenance_requests
     WHERE tenant_id = $1::uuid AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND created_at >= $3::date AND created_at < ($4::date + 1)
       AND is_deleted = false`,
    qParams,
  );

  const byPriority = await query<{
    priority: string;
    count: string;
    completed: string;
    avg_res: string;
  }>(
    `SELECT
       priority,
       COUNT(*)::text AS count,
       COUNT(*) FILTER (WHERE request_status = 'COMPLETED')::text AS completed,
       COALESCE(AVG(resolution_time_hours) FILTER (WHERE resolution_time_hours IS NOT NULL), 0)::text AS avg_res
     FROM maintenance_requests
     WHERE tenant_id = $1::uuid AND ($2::uuid IS NULL OR property_id = $2::uuid)
       AND created_at >= $3::date AND created_at < ($4::date + 1)
       AND is_deleted = false
     GROUP BY priority ORDER BY priority`,
    qParams,
  );

  const s = summary.rows[0]!;
  return {
    total_requests: parseInt(s.total, 10),
    completed: parseInt(s.completed, 10),
    overdue: parseInt(s.overdue, 10),
    avg_response_time_minutes: Math.round(Number(s.avg_response) * 100) / 100,
    avg_resolution_time_hours: Math.round(Number(s.avg_resolution) * 100) / 100,
    by_priority: byPriority.rows.map((r) => ({
      priority: r.priority,
      count: parseInt(r.count, 10),
      completed: parseInt(r.completed, 10),
      avg_resolution_hours: Math.round(Number(r.avg_res) * 100) / 100,
    })),
  };
};

// ─── CG-14: Audit Trail Report ──────────────────────────────────────────────

export type AuditTrailItem = {
  id: string;
  command_name: string;
  initiated_by: string;
  target_service: string;
  status: string;
  created_at: string;
  payload_summary: string | null;
};

/**
 * Query the command outbox for an audit trail of user actions.
 */
export const getAuditTrailReport = async (params: {
  tenantId: string;
  startDate: string;
  endDate: string;
  commandName?: string;
  initiatedBy?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: AuditTrailItem[] }> => {
  const baseParams = [params.tenantId, params.startDate, params.endDate];
  const filters: string[] = [];
  if (params.commandName) {
    baseParams.push(params.commandName);
    filters.push(`AND command_name = $${baseParams.length}`);
  }
  if (params.initiatedBy) {
    baseParams.push(params.initiatedBy);
    filters.push(`AND initiated_by = $${baseParams.length}`);
  }
  const filterSql = filters.join(" ");

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM command_outbox
     WHERE tenant_id = $1::uuid
       AND created_at >= $2::date AND created_at < ($3::date + 1)
       ${filterSql}`,
    baseParams,
  );

  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const offset = Math.max(params.offset ?? 0, 0);

  const { rows } = await query<{
    id: string;
    command_name: string;
    initiated_by: string;
    target_service: string;
    status: string;
    created_at: string;
  }>(
    `SELECT id, command_name, COALESCE(initiated_by, 'system') AS initiated_by,
            COALESCE(target_service, '') AS target_service,
            status, created_at::text
     FROM command_outbox
     WHERE tenant_id = $1::uuid
       AND created_at >= $2::date AND created_at < ($3::date + 1)
       ${filterSql}
     ORDER BY created_at DESC
     LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
    [...baseParams, limit, offset],
  );

  return {
    total: parseInt(countResult.rows[0]?.total ?? "0", 10),
    items: rows.map((r) => ({ ...r, payload_summary: null })),
  };
};
