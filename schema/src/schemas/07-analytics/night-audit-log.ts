/**
 * NightAuditLog Schema
 * @table night_audit_log
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete NightAuditLog schema
 */
export const NightAuditLogSchema = z.object({
	audit_log_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	audit_run_id: uuid,
	business_date_id: uuid.optional(),
	business_date: z.coerce.date(),
	next_business_date: z.coerce.date().optional(),
	started_at: z.coerce.date(),
	completed_at: z.coerce.date().optional(),
	duration_seconds: z.number().int().optional(),
	audit_status: z.string(),
	step_number: z.number().int(),
	step_name: z.string(),
	step_category: z.string().optional(),
	step_status: z.string(),
	step_started_at: z.coerce.date().optional(),
	step_completed_at: z.coerce.date().optional(),
	step_duration_ms: z.number().int().optional(),
	records_processed: z.number().int().optional(),
	records_succeeded: z.number().int().optional(),
	records_failed: z.number().int().optional(),
	records_skipped: z.number().int().optional(),
	amount_posted: money.optional(),
	transactions_created: z.number().int().optional(),
	error_count: z.number().int().optional(),
	warning_count: z.number().int().optional(),
	error_message: z.string().optional(),
	error_details: z.record(z.unknown()).optional(),
	stack_trace: z.string().optional(),
	initiated_by: uuid,
	completed_by: uuid.optional(),
	execution_mode: z.string().optional(),
	is_test_run: z.boolean().optional(),
	process_details: z.record(z.unknown()).optional(),
	configuration: z.record(z.unknown()).optional(),
	occupancy_percent: money.optional(),
	adr: money.optional(),
	revpar: money.optional(),
	total_revenue: money.optional(),
	total_rooms_sold: z.number().int().optional(),
	total_arrivals: z.number().int().optional(),
	total_departures: z.number().int().optional(),
	total_stayovers: z.number().int().optional(),
	is_successful: z.boolean().optional(),
	requires_attention: z.boolean().optional(),
	is_acknowledged: z.boolean().optional(),
	acknowledged_at: z.coerce.date().optional(),
	acknowledged_by: uuid.optional(),
	reports_generated: z.array(z.string()).optional(),
	actions_taken: z.array(z.string()).optional(),
	notes: z.string().optional(),
	resolution_notes: z.string().optional(),
	retry_count: z.number().int().optional(),
	previous_attempt_id: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type NightAuditLog = z.infer<typeof NightAuditLogSchema>;

/**
 * Schema for creating a new night audit log
 */
export const CreateNightAuditLogSchema = NightAuditLogSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateNightAuditLog = z.infer<typeof CreateNightAuditLogSchema>;

/**
 * Schema for updating a night audit log
 */
export const UpdateNightAuditLogSchema = NightAuditLogSchema.partial();

export type UpdateNightAuditLog = z.infer<typeof UpdateNightAuditLogSchema>;
