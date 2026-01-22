/**
 * DEV DOC
 * Module: schemas/07-analytics/audit-logs.ts
 * Description: AuditLogs Schema
 * Table: audit_logs
 * Category: 07-analytics
 * Primary exports: AuditLogsSchema, CreateAuditLogsSchema, UpdateAuditLogsSchema
 * @table audit_logs
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * AuditLogs Schema
 * @table audit_logs
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete AuditLogs schema
 */
export const AuditLogsSchema = z.object({
	audit_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	audit_timestamp: z.coerce.date(),
	event_type: z.string(),
	entity_type: z.string(),
	entity_id: uuid.optional(),
	user_id: uuid,
	user_email: z.string().optional(),
	user_name: z.string().optional(),
	user_role: z.string().optional(),
	action: z.string(),
	action_category: z.string().optional(),
	severity: z.string().optional(),
	old_values: z.record(z.unknown()).optional(),
	new_values: z.record(z.unknown()).optional(),
	changed_fields: z.array(z.string()).optional(),
	ip_address: z.unknown().optional(),
	user_agent: z.string().optional(),
	request_id: z.string().optional(),
	session_id: z.string().optional(),
	api_endpoint: z.string().optional(),
	http_method: z.string().optional(),
	country_code: z.string().optional(),
	city: z.string().optional(),
	is_pci_relevant: z.boolean().optional(),
	is_gdpr_relevant: z.boolean().optional(),
	is_sensitive: z.boolean().optional(),
	status: z.string(),
	error_message: z.string().optional(),
	error_code: z.string().optional(),
	description: z.string().optional(),
	reason: z.string().optional(),
	business_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	response_time_ms: z.number().int().optional(),
});

export type AuditLogs = z.infer<typeof AuditLogsSchema>;

/**
 * Schema for creating a new audit logs
 */
export const CreateAuditLogsSchema = AuditLogsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAuditLogs = z.infer<typeof CreateAuditLogsSchema>;

/**
 * Schema for updating a audit logs
 */
export const UpdateAuditLogsSchema = AuditLogsSchema.partial();

export type UpdateAuditLogs = z.infer<typeof UpdateAuditLogsSchema>;
