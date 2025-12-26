/**
 * ChannelMappings Schema
 * @table channel_mappings
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete ChannelMappings schema
 */
export const ChannelMappingsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	channel_name: z.string(),
	channel_code: z.string(),
	entity_type: z.string(),
	entity_id: uuid,
	external_id: z.string(),
	external_code: z.string().optional(),
	mapping_config: z.record(z.unknown()).optional(),
	last_sync_at: z.coerce.date().optional(),
	last_sync_status: z.string().optional(),
	last_sync_error: z.string().optional(),
	is_active: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
	version: z.bigint().optional(),
});

export type ChannelMappings = z.infer<typeof ChannelMappingsSchema>;

/**
 * Schema for creating a new channel mappings
 */
export const CreateChannelMappingsSchema = ChannelMappingsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateChannelMappings = z.infer<typeof CreateChannelMappingsSchema>;

/**
 * Schema for updating a channel mappings
 */
export const UpdateChannelMappingsSchema = ChannelMappingsSchema.partial();

export type UpdateChannelMappings = z.infer<typeof UpdateChannelMappingsSchema>;
