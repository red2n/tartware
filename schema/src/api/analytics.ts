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

// -----------------------------------------------------------------------------
// S13: Demand Forecast Report
// -----------------------------------------------------------------------------

/** Single-day demand forecast entry. */
export const DemandForecastDaySchema = z.object({
	calendar_date: z.string(),
	demand_level: z.string(),
	demand_score: z.number(),
	occupancy_percent: z.number(),
	forecasted_occupancy_percent: z.number(),
	adr: z.number(),
	forecasted_adr: z.number(),
	revpar: z.number(),
	forecasted_revpar: z.number(),
	rooms_available: z.number(),
	rooms_occupied: z.number(),
	rooms_remaining: z.number(),
	booking_pace: z.string().nullable(),
	recommended_pricing_strategy: z.string().nullable(),
	season: z.string().nullable(),
});

export type DemandForecastDay = z.infer<typeof DemandForecastDaySchema>;

/** Demand forecast report with day-level rows and summary averages. */
export const DemandForecastReportSchema = z.object({
	days: z.array(DemandForecastDaySchema),
	summary: z.object({
		total_days: z.number(),
		avg_demand_score: z.number(),
		avg_occupancy: z.number(),
		avg_forecasted_occupancy: z.number(),
		avg_adr: z.number(),
		avg_revpar: z.number(),
	}),
});

export type DemandForecastReport = z.infer<typeof DemandForecastReportSchema>;

// -----------------------------------------------------------------------------
// S13: Booking Pace Report
// -----------------------------------------------------------------------------

/** Single-day booking pace entry. */
export const PaceDaySchema = z.object({
	calendar_date: z.string(),
	booking_pace: z.string().nullable(),
	pace_vs_last_year: z.number(),
	pace_vs_budget: z.number(),
	pickup_last_7_days: z.number(),
	pickup_last_30_days: z.number(),
	total_bookings: z.number(),
	new_bookings_today: z.number(),
	cancellations_today: z.number(),
	occupancy_percent: z.number(),
	same_day_last_year_occupancy: z.number(),
	variance_vs_last_year_occupancy: z.number(),
});

export type PaceDay = z.infer<typeof PaceDaySchema>;

/** Booking pace report with day-level rows and summary totals. */
export const PaceReportSchema = z.object({
	days: z.array(PaceDaySchema),
	summary: z.object({
		total_days: z.number(),
		avg_pace_vs_last_year: z.number(),
		total_pickup_7d: z.number(),
		total_pickup_30d: z.number(),
		total_new_bookings: z.number(),
		total_cancellations: z.number(),
	}),
});

export type PaceReport = z.infer<typeof PaceReportSchema>;

// -----------------------------------------------------------------------------
// S13: Revenue Forecast Report
// -----------------------------------------------------------------------------

/** Single revenue forecast entry. */
export const RevenueForecastEntrySchema = z.object({
	forecast_date: z.string(),
	forecast_period: z.string(),
	forecast_type: z.string(),
	forecast_scenario: z.string(),
	forecasted_value: z.number(),
	confidence_level: z.number(),
	confidence_interval_low: z.number().nullable(),
	confidence_interval_high: z.number().nullable(),
	actual_value: z.number().nullable(),
	variance_percent: z.number().nullable(),
	room_revenue_forecast: z.number(),
	fb_revenue_forecast: z.number(),
	other_revenue_forecast: z.number(),
	total_revenue_forecast: z.number(),
	forecasted_occupancy_percent: z.number(),
	forecasted_adr: z.number(),
	forecasted_revpar: z.number(),
	review_status: z.string(),
});

export type RevenueForecastEntry = z.infer<typeof RevenueForecastEntrySchema>;

/** Revenue forecast report with paginated entries. */
export const RevenueForecastReportSchema = z.object({
	forecasts: z.array(RevenueForecastEntrySchema),
	total: z.number(),
});

export type RevenueForecastReport = z.infer<typeof RevenueForecastReportSchema>;
