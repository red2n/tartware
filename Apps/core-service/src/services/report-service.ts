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
