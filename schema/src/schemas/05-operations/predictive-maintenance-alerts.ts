/**
 * DEV DOC
 * Module: schemas/05-operations/predictive-maintenance-alerts.ts
 * Description: PredictiveMaintenanceAlerts Schema
 * Table: predictive_maintenance_alerts
 * Category: 05-operations
 * Primary exports: PredictiveMaintenanceAlertsSchema, CreatePredictiveMaintenanceAlertsSchema, UpdatePredictiveMaintenanceAlertsSchema
 * @table predictive_maintenance_alerts
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * PredictiveMaintenanceAlerts Schema
 * @table predictive_maintenance_alerts
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete PredictiveMaintenanceAlerts schema
 */
export const PredictiveMaintenanceAlertsSchema = z.object({
	alert_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	asset_id: uuid,
	alert_type: z.string(),
	severity: z.string(),
	alert_title: z.string(),
	alert_description: z.string().optional(),
	predicted_failure_date: z.coerce.date().optional(),
	confidence_level: money.optional(),
	failure_mode: z.string().optional(),
	root_cause: z.string().optional(),
	ml_model_name: z.string().optional(),
	ml_model_version: z.string().optional(),
	prediction_factors: z.record(z.unknown()).optional(),
	sensor_readings: z.record(z.unknown()).optional(),
	historical_pattern: z.record(z.unknown()).optional(),
	threshold_exceeded: z.string().optional(),
	impact_level: z.string().optional(),
	affects_guest_experience: z.boolean().optional(),
	affects_operations: z.boolean().optional(),
	affects_safety: z.boolean().optional(),
	estimated_downtime_hours: z.number().int().optional(),
	estimated_repair_cost: money.optional(),
	recommended_action: z.string(),
	action_urgency: z.string().optional(),
	recommended_service_provider: z.string().optional(),
	estimated_repair_duration_hours: z.number().int().optional(),
	alternative_actions: z.record(z.unknown()).optional(),
	work_order_created: z.boolean().optional(),
	work_order_id: uuid.optional(),
	work_order_created_at: z.coerce.date().optional(),
	alert_status: z.string().optional(),
	triggered_at: z.coerce.date().optional(),
	acknowledged_at: z.coerce.date().optional(),
	acknowledged_by: uuid.optional(),
	resolved_at: z.coerce.date().optional(),
	resolved_by: uuid.optional(),
	resolution_notes: z.string().optional(),
	actual_failure_date: z.coerce.date().optional(),
	prediction_accuracy: z.string().optional(),
	actual_repair_cost: money.optional(),
	actual_downtime_hours: z.number().int().optional(),
	prevented_failure: z.boolean().optional(),
	cost_savings: money.optional(),
	notification_sent: z.boolean().optional(),
	notified_users: z.array(uuid).optional(),
	notification_sent_at: z.coerce.date().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type PredictiveMaintenanceAlerts = z.infer<
	typeof PredictiveMaintenanceAlertsSchema
>;

/**
 * Schema for creating a new predictive maintenance alerts
 */
export const CreatePredictiveMaintenanceAlertsSchema =
	PredictiveMaintenanceAlertsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreatePredictiveMaintenanceAlerts = z.infer<
	typeof CreatePredictiveMaintenanceAlertsSchema
>;

/**
 * Schema for updating a predictive maintenance alerts
 */
export const UpdatePredictiveMaintenanceAlertsSchema =
	PredictiveMaintenanceAlertsSchema.partial();

export type UpdatePredictiveMaintenanceAlerts = z.infer<
	typeof UpdatePredictiveMaintenanceAlertsSchema
>;
