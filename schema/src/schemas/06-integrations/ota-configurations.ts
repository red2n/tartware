/**
 * OtaConfigurations Schema
 * @table ota_configurations
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete OtaConfigurations schema
 */
export const OtaConfigurationsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	ota_name: z.string(),
	ota_code: z.string(),
	api_endpoint: z.string().optional(),
	api_key: z.string().optional(),
	api_secret: z.string().optional(),
	hotel_id: z.string().optional(),
	channel_manager: z.string().optional(),
	is_active: z.boolean().optional(),
	sync_enabled: z.boolean().optional(),
	sync_frequency_minutes: z.number().int().optional(),
	last_sync_at: z.coerce.date().optional(),
	sync_status: z.string().optional(),
	sync_error_message: z.string().optional(),
	rate_push_enabled: z.boolean().optional(),
	availability_push_enabled: z.boolean().optional(),
	reservation_pull_enabled: z.boolean().optional(),
	commission_percentage: money.optional(),
	currency_code: z.string().optional(),
	configuration_json: z.record(z.unknown()).optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	deleted_at: z.coerce.date().optional(),
});

export type OtaConfigurations = z.infer<typeof OtaConfigurationsSchema>;

/**
 * Schema for creating a new ota configurations
 */
export const CreateOtaConfigurationsSchema = OtaConfigurationsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateOtaConfigurations = z.infer<
	typeof CreateOtaConfigurationsSchema
>;

/**
 * Schema for updating a ota configurations
 */
export const UpdateOtaConfigurationsSchema = OtaConfigurationsSchema.partial();

export type UpdateOtaConfigurations = z.infer<
	typeof UpdateOtaConfigurationsSchema
>;
