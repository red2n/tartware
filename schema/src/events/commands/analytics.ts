/**
 * DEV DOC
 * Module: events/commands/analytics.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

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
