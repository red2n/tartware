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
