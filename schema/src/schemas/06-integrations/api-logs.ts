/**
 * DEV DOC
 * Module: schemas/06-integrations/api-logs.ts
 * Description: ApiLogs Schema
 * Table: api_logs
 * Category: 06-integrations
 * Primary exports: ApiLogsSchema, CreateApiLogsSchema, UpdateApiLogsSchema
 * @table api_logs
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * ApiLogs Schema
 * @table api_logs
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete ApiLogs schema
 */
export const ApiLogsSchema = z.object({
	log_id: uuid,
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid.optional(),
	api_name: z.string().optional(),
	endpoint: z.string(),
	http_method: z.string().optional(),
	request_timestamp: z.coerce.date().optional(),
	response_timestamp: z.coerce.date().optional(),
	duration_ms: z.number().int().optional(),
	status_code: z.number().int().optional(),
	status_message: z.string().optional(),
	request_headers: z.record(z.unknown()).optional(),
	request_body: z.record(z.unknown()).optional(),
	response_headers: z.record(z.unknown()).optional(),
	response_body: z.record(z.unknown()).optional(),
	success: z.boolean().optional(),
	error_message: z.string().optional(),
	ip_address: z.string().optional(),
	user_agent: z.string().optional(),
	user_id: uuid.optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
});

export type ApiLogs = z.infer<typeof ApiLogsSchema>;

/**
 * Schema for creating a new api logs
 */
export const CreateApiLogsSchema = ApiLogsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateApiLogs = z.infer<typeof CreateApiLogsSchema>;

/**
 * Schema for updating a api logs
 */
export const UpdateApiLogsSchema = ApiLogsSchema.partial();

export type UpdateApiLogs = z.infer<typeof UpdateApiLogsSchema>;
