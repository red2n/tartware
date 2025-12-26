/**
 * AnalyticsMetricDimensions Schema
 * @table analytics_metric_dimensions
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete AnalyticsMetricDimensions schema
 */
export const AnalyticsMetricDimensionsSchema = z.object({
	id: uuid,
	metric_id: uuid,
	tenant_id: uuid,
	dimension_type: z.string(),
	dimension_key: z.string(),
	dimension_value: z.string(),
	metric_value: money,
	percentage_of_total: money.optional(),
	rank_position: z.number().int().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
	version: z.bigint().optional(),
});

export type AnalyticsMetricDimensions = z.infer<
	typeof AnalyticsMetricDimensionsSchema
>;

/**
 * Schema for creating a new analytics metric dimensions
 */
export const CreateAnalyticsMetricDimensionsSchema =
	AnalyticsMetricDimensionsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateAnalyticsMetricDimensions = z.infer<
	typeof CreateAnalyticsMetricDimensionsSchema
>;

/**
 * Schema for updating a analytics metric dimensions
 */
export const UpdateAnalyticsMetricDimensionsSchema =
	AnalyticsMetricDimensionsSchema.partial();

export type UpdateAnalyticsMetricDimensions = z.infer<
	typeof UpdateAnalyticsMetricDimensionsSchema
>;
