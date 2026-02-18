/**
 * DEV DOC
 * Module: events/commands/analytics.ts
 * Description: Analytics command schemas for metric ingestion and report scheduling
 * Primary exports: AnalyticsMetricIngestCommandSchema, AnalyticsReportScheduleCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

/**
 * Ingest a single analytics metric data point.
 * Records a metric value with optional dimensions for
 * downstream aggregation and dashboard reporting.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const AnalyticsMetricIngestCommandSchema = z.object({
	metric_code: z.string().min(2).max(100),
	value: z.coerce.number(),
	recorded_at: z.coerce.date().optional(),
	property_id: z.string().uuid().optional(),
	dimensions: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type AnalyticsMetricIngestCommand = z.infer<
	typeof AnalyticsMetricIngestCommandSchema
>;

/**
 * Schedule or update a recurring analytics report.
 * Configures periodic generation of reports with
 * specified parameters and delivery settings.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const AnalyticsReportScheduleCommandSchema = z.object({
	report_id: z.string().uuid(),
	schedule_config: z.record(z.unknown()),
	enabled: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type AnalyticsReportScheduleCommand = z.infer<
	typeof AnalyticsReportScheduleCommandSchema
>;
