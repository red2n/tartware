import {
  type GuestListReport,
  GuestListItemSchema,
  GuestListReportSchema,
  type OccupancyReport,
  OccupancyReportSchema,
  type PerformanceReport,
  PerformanceReportSchema,
  ReservationSourceSummarySchema,
  type ReservationStatusSummary,
  ReservationStatusSummarySchema,
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
