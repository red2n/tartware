/**
 * MobileKeys Schema
 * @table mobile_keys
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete MobileKeys schema
 */
export const MobileKeysSchema = z.object({
	key_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	reservation_id: uuid,
	room_id: uuid,
	key_code: z.string(),
	key_type: z.string().optional(),
	status: z.string().optional(),
	valid_from: z.coerce.date(),
	valid_to: z.coerce.date(),
	access_granted_at: z.coerce.date().optional(),
	last_used_at: z.coerce.date().optional(),
	usage_count: z.number().int().optional(),
	device_id: z.string().optional(),
	device_type: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type MobileKeys = z.infer<typeof MobileKeysSchema>;

/**
 * Schema for creating a new mobile keys
 */
export const CreateMobileKeysSchema = MobileKeysSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMobileKeys = z.infer<typeof CreateMobileKeysSchema>;

/**
 * Schema for updating a mobile keys
 */
export const UpdateMobileKeysSchema = MobileKeysSchema.partial();

export type UpdateMobileKeys = z.infer<typeof UpdateMobileKeysSchema>;
