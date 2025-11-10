/**
 * GdsMessageLog Schema
 * @table gds_message_log
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete GdsMessageLog schema
 */
export const GdsMessageLogSchema = z.object({
	gds_message_id: uuid,
	gds_connection_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	message_direction: z.string(),
	message_type: z.string(),
	correlation_id: z.string().optional(),
	conversation_id: z.string().optional(),
	sequence_number: z.bigint().optional(),
	payload: z.unknown().optional(),
	payload_hash: z.string().optional(),
	transformed_payload: z.record(z.unknown()).optional(),
	status: z.string(),
	http_status: z.number().int().optional(),
	ack_code: z.string().optional(),
	ack_message: z.string().optional(),
	error_category: z.string().optional(),
	error_details: z.string().optional(),
	received_at: z.coerce.date(),
	processed_at: z.coerce.date().optional(),
	acked_at: z.coerce.date().optional(),
	retry_count: z.number().int().optional(),
	next_retry_at: z.coerce.date().optional(),
	created_at: z.coerce.date(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type GdsMessageLog = z.infer<typeof GdsMessageLogSchema>;

/**
 * Schema for creating a new gds message log
 */
export const CreateGdsMessageLogSchema = GdsMessageLogSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateGdsMessageLog = z.infer<typeof CreateGdsMessageLogSchema>;

/**
 * Schema for updating a gds message log
 */
export const UpdateGdsMessageLogSchema = GdsMessageLogSchema.partial();

export type UpdateGdsMessageLog = z.infer<typeof UpdateGdsMessageLogSchema>;
