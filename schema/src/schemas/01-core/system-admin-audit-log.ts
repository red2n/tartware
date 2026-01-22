/**
 * DEV DOC
 * Module: schemas/01-core/system-admin-audit-log.ts
 * Description: System Admin Audit Log Schema
 * Table: system_admin_audit_log
 * Category: 01-core
 * Primary exports: SystemAdminAuditLogSchema, CreateSystemAdminAuditLogSchema, UpdateSystemAdminAuditLogSchema
 * @table system_admin_audit_log
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * System Admin Audit Log Schema
 * @table system_admin_audit_log
 * @category 01-core
 * @synchronized 2025-11-19 (generated via `npm run generate -- 01-core system_admin_audit_log`)
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

export const SystemAdminAuditLogSchema = z.object({
	id: z.bigint(),
	admin_id: uuid,
	action: z.string(),
	resource_type: z.string().optional(),
	resource_id: uuid.optional(),
	tenant_id: uuid.optional(),
	request_method: z.string().optional(),
	request_path: z.string().optional(),
	request_payload: z.record(z.unknown()).optional(),
	response_status: z.number().int().optional(),
	ip_address: z.string().optional(),
	user_agent: z.string().optional(),
	session_id: z.string().optional(),
	impersonated_user_id: uuid.optional(),
	ticket_id: z.string().optional(),
	timestamp: z.coerce.date(),
	checksum: z.string(),
	metadata: jsonbMetadata,
});

export type SystemAdminAuditLog = z.infer<typeof SystemAdminAuditLogSchema>;

export const CreateSystemAdminAuditLogSchema = SystemAdminAuditLogSchema.omit({
	id: true,
	timestamp: true,
});
export type CreateSystemAdminAuditLog = z.infer<
	typeof CreateSystemAdminAuditLogSchema
>;

export const UpdateSystemAdminAuditLogSchema = SystemAdminAuditLogSchema.partial().extend({
	id: z.bigint(),
});
export type UpdateSystemAdminAuditLog = z.infer<
	typeof UpdateSystemAdminAuditLogSchema
>;
