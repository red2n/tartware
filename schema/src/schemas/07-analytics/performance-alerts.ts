/**
 * DEV DOC
 * Module: schemas/07-analytics/performance-alerts.ts
 * Description: PerformanceAlerts Schema
 * Table: performance_alerts
 * Category: 07-analytics
 * Primary exports: PerformanceAlertsSchema, CreatePerformanceAlertsSchema, UpdatePerformanceAlertsSchema
 * @table performance_alerts
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * PerformanceAlerts Schema
 * @table performance_alerts
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete PerformanceAlerts schema
 */
export const PerformanceAlertsSchema = z.object({
	alert_id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	alert_type: z.string(),
	severity: z.string(),
	metric_name: z.string().optional(),
	current_value: money.optional(),
	baseline_value: money.optional(),
	deviation_percent: money.optional(),
	alert_message: z.string(),
	details: z.record(z.unknown()).optional(),
	acknowledged: z.boolean().optional(),
	acknowledged_by: z.string().optional(),
	acknowledged_at: z.coerce.date().optional(),
	created_at: z.coerce.date().optional(),
});

export type PerformanceAlerts = z.infer<typeof PerformanceAlertsSchema>;

/**
 * Schema for creating a new performance alerts
 */
export const CreatePerformanceAlertsSchema = PerformanceAlertsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreatePerformanceAlerts = z.infer<
	typeof CreatePerformanceAlertsSchema
>;

/**
 * Schema for updating a performance alerts
 */
export const UpdatePerformanceAlertsSchema = PerformanceAlertsSchema.partial();

export type UpdatePerformanceAlerts = z.infer<
	typeof UpdatePerformanceAlertsSchema
>;
