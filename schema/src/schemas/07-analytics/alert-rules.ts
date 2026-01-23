/**
 * DEV DOC
 * Module: schemas/07-analytics/alert-rules.ts
 * Description: AlertRules Schema
 * Table: alert_rules
 * Category: 07-analytics
 * Primary exports: AlertRulesSchema, CreateAlertRulesSchema, UpdateAlertRulesSchema
 * @table alert_rules
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * AlertRules Schema
 * @table alert_rules
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete AlertRules schema
 */
export const AlertRulesSchema = z.object({
	rule_id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	rule_name: z.string(),
	metric_query: z.string(),
	condition_type: z.string(),
	threshold_value: money.optional(),
	deviation_percent: money.optional(),
	time_window: z.unknown().optional(),
	severity: z.string().optional(),
	is_active: z.boolean().optional(),
	notification_channels: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
});

export type AlertRules = z.infer<typeof AlertRulesSchema>;

/**
 * Schema for creating a new alert rules
 */
export const CreateAlertRulesSchema = AlertRulesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAlertRules = z.infer<typeof CreateAlertRulesSchema>;

/**
 * Schema for updating a alert rules
 */
export const UpdateAlertRulesSchema = AlertRulesSchema.partial();

export type UpdateAlertRules = z.infer<typeof UpdateAlertRulesSchema>;
