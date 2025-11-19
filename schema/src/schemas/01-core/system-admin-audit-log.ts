/**
 * System Admin Audit Log Schema
 * @table system_admin_audit_log
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

const requestPayload = z.record(z.unknown()).optional();

export const SystemAdminAuditLogSchema = z.object({
	id: z.bigint().describe("Surrogate primary key (BIGSERIAL)"),
	admin_id: uuid,
	action: z.string().min(3).max(100),
	resource_type: z.string().max(50).optional(),
	resource_id: uuid.optional(),
	tenant_id: uuid.optional(),
	request_method: z.string().max(10).optional(),
	request_path: z.string().max(500).optional(),
	request_payload: requestPayload,
	response_status: z.number().int().min(100).max(599).optional(),
	ip_address: z.string().max(45).optional(),
	user_agent: z.string().max(500).optional(),
	session_id: z.string().max(255).optional(),
	impersonated_user_id: uuid.optional(),
	ticket_id: z.string().max(100).optional(),
	timestamp: z.coerce.date(),
	checksum: z.string().length(64).optional(),
});

export type SystemAdminAuditLog = z.infer<typeof SystemAdminAuditLogSchema>;

export const CreateSystemAdminAuditLogSchema =
	SystemAdminAuditLogSchema.omit({
		id: true,
		timestamp: true,
	});

export type CreateSystemAdminAuditLog = z.infer<
	typeof CreateSystemAdminAuditLogSchema
>;
