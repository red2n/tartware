/**
 * DEV DOC
 * Module: api/analytics.ts
 * Purpose: Analytics and reporting API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// Reservation Status Summary Schemas
// -----------------------------------------------------------------------------

/**
 * Reservation status summary response schema.
 * Used for dashboard/reporting endpoints.
 */
export const ReservationStatusSummarySchema = z.object({
	confirmed: z.number().nonnegative().default(0),
	pending: z.number().nonnegative().default(0),
	checked_in: z.number().nonnegative().default(0),
	checked_out: z.number().nonnegative().default(0),
	cancelled: z.number().nonnegative().default(0),
	no_show: z.number().nonnegative().default(0),
});

export type ReservationStatusSummary = z.infer<typeof ReservationStatusSummarySchema>;

// -----------------------------------------------------------------------------
// Revenue Summary Schemas
// -----------------------------------------------------------------------------

/**
 * Revenue summary response schema.
 * Provides today/MTD/YTD revenue aggregations.
 */
export const RevenueSummarySchema = z.object({
	today: z.number().nonnegative(),
	monthToDate: z.number().nonnegative(),
	yearToDate: z.number().nonnegative(),
	currency: z.string(),
});

export type RevenueSummary = z.infer<typeof RevenueSummarySchema>;

// -----------------------------------------------------------------------------
// Reservation Source Summary Schemas
// -----------------------------------------------------------------------------

/**
 * Reservation source summary schema.
 * Shows booking volume and revenue by source channel.
 */
export const ReservationSourceSummarySchema = z.object({
	source: z.string(),
	reservations: z.number().nonnegative(),
	total_amount: z.number().nonnegative(),
});

export type ReservationSourceSummary = z.infer<typeof ReservationSourceSummarySchema>;

// -----------------------------------------------------------------------------
// Performance Report Schemas
// -----------------------------------------------------------------------------

/**
 * Performance report response schema.
 * Composite report with status summary, revenue, and top sources.
 */
export const PerformanceReportSchema = z.object({
	statusSummary: ReservationStatusSummarySchema,
	revenueSummary: RevenueSummarySchema,
	topSources: z.array(ReservationSourceSummarySchema),
});

export type PerformanceReport = z.infer<typeof PerformanceReportSchema>;

// -----------------------------------------------------------------------------
// Occupancy Report Schemas
// -----------------------------------------------------------------------------

/** Single-date occupancy row. */
export const OccupancyDaySchema = z.object({
  date: z.string(),
  total_rooms: z.number().int().nonnegative(),
  rooms_sold: z.number().int().nonnegative(),
  rooms_available: z.number().int().nonnegative(),
  occupancy_pct: z.number().nonnegative(),
});

export type OccupancyDay = z.infer<typeof OccupancyDaySchema>;

/** Occupancy report response: array of date-level rows plus summary. */
export const OccupancyReportSchema = z.object({
  summary: z.object({
    total_room_nights: z.number().int().nonnegative(),
    rooms_sold: z.number().int().nonnegative(),
    avg_occupancy_pct: z.number().nonnegative(),
  }),
  days: z.array(OccupancyDaySchema),
});

export type OccupancyReport = z.infer<typeof OccupancyReportSchema>;

// -----------------------------------------------------------------------------
// Revenue KPI Schemas
// -----------------------------------------------------------------------------

/** Revenue KPI response with ADR, RevPAR, TRevPAR. */
export const RevenueKpiReportSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  total_room_revenue: z.number().nonnegative(),
  total_revenue: z.number().nonnegative(),
  rooms_sold: z.number().int().nonnegative(),
  available_room_nights: z.number().int().nonnegative(),
  occupancy_pct: z.number().nonnegative(),
  adr: z.number().nonnegative(),
  revpar: z.number().nonnegative(),
  trevpar: z.number().nonnegative(),
  currency: z.string(),
});

export type RevenueKpiReport = z.infer<typeof RevenueKpiReportSchema>;

// -----------------------------------------------------------------------------
// Guest List Schemas (Arrivals / Departures / In-House)
// -----------------------------------------------------------------------------

/** Compact guest item for operational lists. */
export const GuestListItemSchema = z.object({
  reservation_id: z.string().uuid(),
  confirmation_number: z.string(),
  guest_name: z.string(),
  guest_email: z.string().optional(),
  guest_phone: z.string().nullable().optional(),
  room_number: z.string().nullable().optional(),
  room_type: z.string().optional(),
  check_in_date: z.string(),
  check_out_date: z.string(),
  status: z.string(),
  source: z.string().optional(),
  special_requests: z.string().nullable().optional(),
  eta: z.string().nullable().optional(),
  number_of_adults: z.number().int().nonnegative().optional(),
  number_of_children: z.number().int().nonnegative().optional(),
  vip: z.boolean().optional(),
});

export type GuestListItem = z.infer<typeof GuestListItemSchema>;

/** Paginated guest list response. */
export const GuestListReportSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(GuestListItemSchema),
});

export type GuestListReport = z.infer<typeof GuestListReportSchema>;
