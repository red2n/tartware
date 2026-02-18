/**
 * DEV DOC
 * Module: schemas/07-analytics/performance-thresholds.ts
 * Description: PerformanceThresholds Schema
 * Table: performance_thresholds
 * Category: 07-analytics
 * Primary exports: PerformanceThresholdsSchema, CreatePerformanceThresholdsSchema, UpdatePerformanceThresholdsSchema
 * @table performance_thresholds
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * PerformanceThresholds Schema
 * @table performance_thresholds
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete PerformanceThresholds schema
 */
export const PerformanceThresholdsSchema = z.object({
	threshold_id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	metric_name: z.string(),
	warning_threshold: money.optional(),
	critical_threshold: money.optional(),
	check_interval: z.unknown().optional(),
	is_active: z.boolean().optional(),
	last_checked: z.coerce.date().optional(),
	alert_recipients: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
});

export type PerformanceThresholds = z.infer<typeof PerformanceThresholdsSchema>;

/**
 * Schema for creating a new performance thresholds
 */
export const CreatePerformanceThresholdsSchema =
	PerformanceThresholdsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreatePerformanceThresholds = z.infer<
	typeof CreatePerformanceThresholdsSchema
>;

/**
 * Schema for updating a performance thresholds
 */
export const UpdatePerformanceThresholdsSchema =
	PerformanceThresholdsSchema.partial();

export type UpdatePerformanceThresholds = z.infer<
	typeof UpdatePerformanceThresholdsSchema
>;
