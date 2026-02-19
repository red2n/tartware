/**
 * DEV DOC
 * Module: schemas/05-operations/pbx-configurations.ts
 * Description: PBX Configuration Schema
 * Table: pbx_configurations
 * Category: 05-operations
 * Primary exports: PbxConfigurationsSchema, CreatePbxConfigurationsSchema, UpdatePbxConfigurationsSchema
 * @table pbx_configurations
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * PBX / Telephony Configuration Schema
 * Property-level PBX integration settings for call billing, permissions, and wake-up calls
 * @table pbx_configurations
 * @category 05-operations
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/** Protocol used to receive CDR data from the PBX */
export const integrationProtocolEnum = z.enum([
	"SMDR",
	"CDR",
	"SIP",
	"TAPI",
	"REST",
]);
export type IntegrationProtocol = z.infer<typeof integrationProtocolEnum>;

/**
 * Complete PBX Configurations schema
 */
export const PbxConfigurationsSchema = z.object({
	config_id: uuid,
	tenant_id: uuid,
	property_id: uuid,

	// PBX System Identity
	config_name: z.string().max(200),
	pbx_vendor: z.string().max(100).optional(),
	pbx_host: z.string().max(255).optional(),
	pbx_port: z.number().int().positive().optional(),
	integration_protocol: integrationProtocolEnum.optional(),

	// Call Billing Rates
	local_call_rate: z.number().min(0).default(0),
	national_call_rate: z.number().min(0).default(0),
	international_call_rate: z.number().min(0).default(0),
	toll_free_rate: z.number().min(0).default(0),
	premium_rate: z.number().min(0).default(0),
	service_charge_percentage: z.number().min(0).max(100).default(0),
	minimum_charge: z.number().min(0).default(0),

	// Call Allowances
	free_local_minutes: z.number().int().min(0).default(0),
	free_national_minutes: z.number().int().min(0).default(0),

	// Prefix Configuration
	local_prefixes: z.array(z.string()).default([]),
	national_prefixes: z.array(z.string()).default([]),
	international_prefix: z.string().max(10).default("00"),
	emergency_numbers: z.array(z.string()).default(["911", "112", "999"]),
	blocked_prefixes: z.array(z.string()).default([]),

	// Wake-Up Call Defaults
	wakeup_enabled: z.boolean().default(true),
	wakeup_retry_count: z.number().int().min(0).default(3),
	wakeup_retry_interval_minutes: z.number().int().min(1).default(5),
	wakeup_snooze_minutes: z.number().int().min(1).default(10),

	// Room Phone Defaults
	allow_outgoing_local: z.boolean().default(true),
	allow_outgoing_national: z.boolean().default(false),
	allow_outgoing_international: z.boolean().default(false),
	allow_room_to_room: z.boolean().default(true),
	auto_enable_on_checkin: z.boolean().default(true),
	auto_disable_on_checkout: z.boolean().default(true),
	auto_post_charges: z.boolean().default(true),

	// Status
	is_active: z.boolean().default(true),

	// Audit
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type PbxConfigurations = z.infer<typeof PbxConfigurationsSchema>;

/**
 * Schema for creating a new PBX configuration
 */
export const CreatePbxConfigurationsSchema = PbxConfigurationsSchema.omit({
	config_id: true,
	created_at: true,
	updated_at: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreatePbxConfigurations = z.infer<
	typeof CreatePbxConfigurationsSchema
>;

/**
 * Schema for updating a PBX configuration
 */
export const UpdatePbxConfigurationsSchema =
	PbxConfigurationsSchema.partial().omit({
		config_id: true,
		tenant_id: true,
		created_at: true,
	});

export type UpdatePbxConfigurations = z.infer<
	typeof UpdatePbxConfigurationsSchema
>;
