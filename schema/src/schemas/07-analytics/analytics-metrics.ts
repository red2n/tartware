/**
 * DEV DOC
 * Module: schemas/07-analytics/analytics-metrics.ts
 * Description: AnalyticsMetrics Schema
 * Table: analytics_metrics
 * Category: 07-analytics
 * Primary exports: AnalyticsMetricsSchema, CreateAnalyticsMetricsSchema, UpdateAnalyticsMetricsSchema
 * @table analytics_metrics
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * AnalyticsMetrics Schema
 * @table analytics_metrics
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";
import {
	AnalyticsStatusEnum,
	MetricTypeEnum,
	TimeGranularityEnum,
} from "../../shared/enums.js";

/**
 * Complete AnalyticsMetrics schema
 */
export const AnalyticsMetricsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	metric_type: MetricTypeEnum,
	metric_name: z.string(),
	metric_code: z.string(),
	metric_date: z.coerce.date(),
	time_granularity: TimeGranularityEnum,
	metric_value: money,
	metric_unit: z.string().optional(),
	room_type_id: uuid.optional(),
	rate_id: uuid.optional(),
	source: z.string().optional(),
	segment: z.string().optional(),
	previous_period_value: money.optional(),
	previous_year_value: money.optional(),
	budget_value: money.optional(),
	forecast_value: money.optional(),
	period_variance: money.optional(),
	year_variance: money.optional(),
	status: AnalyticsStatusEnum,
	calculation_method: z.string().optional(),
	calculated_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
});

export type AnalyticsMetrics = z.infer<typeof AnalyticsMetricsSchema>;

/**
 * Schema for creating a new analytics metrics
 */
export const CreateAnalyticsMetricsSchema = AnalyticsMetricsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAnalyticsMetrics = z.infer<
	typeof CreateAnalyticsMetricsSchema
>;

/**
 * Schema for updating a analytics metrics
 */
export const UpdateAnalyticsMetricsSchema = AnalyticsMetricsSchema.partial();

export type UpdateAnalyticsMetrics = z.infer<
	typeof UpdateAnalyticsMetricsSchema
>;
