/**
 * IntegrationMappings Schema
 * @table integration_mappings
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete IntegrationMappings schema
 */
export const IntegrationMappingsSchema = z.object({
	mapping_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	integration_name: z.string(),
	integration_type: z.string(),
	external_system: z.string(),
	target_system: z.string(),
	source_entity: z.string(),
	target_entity: z.string(),
	field_mappings: z.record(z.unknown()),
	transformation_rules: z.record(z.unknown()).optional(),
	is_active: z.boolean().optional(),
	is_bidirectional: z.boolean().optional(),
	sync_frequency: z.string().optional(),
	last_sync_at: z.coerce.date().optional(),
	next_sync_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type IntegrationMappings = z.infer<typeof IntegrationMappingsSchema>;

/**
 * Schema for creating a new integration mappings
 */
export const CreateIntegrationMappingsSchema = IntegrationMappingsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateIntegrationMappings = z.infer<
	typeof CreateIntegrationMappingsSchema
>;

/**
 * Schema for updating a integration mappings
 */
export const UpdateIntegrationMappingsSchema =
	IntegrationMappingsSchema.partial();

export type UpdateIntegrationMappings = z.infer<
	typeof UpdateIntegrationMappingsSchema
>;
