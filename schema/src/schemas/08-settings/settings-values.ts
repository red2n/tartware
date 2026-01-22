/**
 * DEV DOC
 * Module: schemas/08-settings/settings-values.ts
 * Description: Settings Values Schema
 * Table: settings_values
 * Category: 08-settings
 * Primary exports: SettingsValuesSchema, CreateSettingsValueSchema, UpdateSettingsValueSchema
 * @table settings_values
 * @category 08-settings
 * Ownership: Schema package
 */

/**
 * Settings Values Schema
 * @table settings_values
 * @category 08-settings
 * @synchronized 2025-11-13
 */

import { z } from "zod";

import { jsonbMetadata, jsonbSettings, uuid } from "../../shared/base-schemas.js";
import { SettingsScopeEnum } from "../../shared/enums.js";

const SettingsValuePayloadSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.array(z.union([z.string(), z.number(), z.boolean()])),
	z.record(z.unknown()),
]);

/**
 * Stores the resolved value of a setting per scope (tenant/property/unit/user)
 */
export const SettingsValuesSchema = z.object({
	id: uuid,
	setting_id: uuid,
	scope_level: SettingsScopeEnum,
	tenant_id: uuid,
	property_id: uuid.optional(),
	unit_id: uuid.optional(),
	user_id: uuid.optional(),
	value: SettingsValuePayloadSchema.or(z.null()),
	is_overridden: z.boolean().default(false),
	is_inherited: z.boolean().default(false),
	inheritance_path: z.array(uuid).optional(),
	inherited_from_value_id: uuid.optional(),
	locked_until: z.coerce.date().optional(),
	effective_from: z.coerce.date().optional(),
	effective_to: z.coerce.date().optional(),
	source: z
		.enum(["MANUAL", "IMPORT", "INTEGRATION", "DEFAULT", "API"])
		.default("MANUAL"),
	status: z.enum(["ACTIVE", "PENDING", "EXPIRED"]).default("ACTIVE"),
	notes: z.string().max(1024).optional(),
	context: jsonbSettings,
	metadata: jsonbMetadata,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
});

export type SettingsValue = z.infer<typeof SettingsValuesSchema>;

export const CreateSettingsValueSchema = SettingsValuesSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
});

export type CreateSettingsValue = z.infer<typeof CreateSettingsValueSchema>;

export const UpdateSettingsValueSchema = SettingsValuesSchema.partial().extend({
	id: uuid,
});

export type UpdateSettingsValue = z.infer<typeof UpdateSettingsValueSchema>;
