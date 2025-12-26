/**
 * PerformanceAlerts Schema
 * @table performance_alerts
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete PerformanceAlerts schema
 */
export const PerformanceAlertsSchema = z.object({
	alert_id: uuid,
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
