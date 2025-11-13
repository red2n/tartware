/**
 * Settings Definitions Schema
 * @table settings_definitions
 * @category 08-settings
 * @synchronized 2025-11-13
 */

import { z } from "zod";

import { jsonbMetadata, jsonbSettings, uuid } from "../../shared/base-schemas.js";
import {
	SettingsControlTypeEnum,
	SettingsDataTypeEnum,
	SettingsScopeEnum,
	SettingsSensitivityEnum,
} from "../../shared/enums.js";

const SettingValueSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.array(z.union([z.string(), z.number(), z.boolean()])),
	z.record(z.unknown()),
]);

/**
 * Catalog definition for an individual setting
 */
export const SettingsDefinitionsSchema = z.object({
	id: uuid,
	category_id: uuid,
	section_id: uuid,
	code: z
		.string()
		.min(3)
		.max(96)
		.regex(/^[A-Z0-9_.-]+$/, {
			message: "Code must be uppercase alphanumeric with separators (._-)",
		}),
	name: z.string().min(3).max(160),
	description: z.string().max(4096),
	help_text: z.string().max(2048).optional(),
	placeholder: z.string().max(256).optional(),
	tooltip: z.string().max(512).optional(),
	data_type: SettingsDataTypeEnum,
	control_type: SettingsControlTypeEnum,
	default_value: SettingValueSchema.optional(),
	value_constraints: jsonbSettings,
	allowed_scopes: z.array(SettingsScopeEnum).nonempty(),
	default_scope: SettingsScopeEnum,
	override_scopes: z.array(SettingsScopeEnum).optional(),
	is_required: z.boolean().default(false),
	is_advanced: z.boolean().default(false),
	is_readonly: z.boolean().default(false),
	is_deprecated: z.boolean().default(false),
	sensitivity: SettingsSensitivityEnum.default("INTERNAL"),
	module_dependencies: z.array(z.string()).optional(),
	feature_flag: z.string().optional(),
	compliance_tags: z.array(z.string()).optional(),
	related_settings: z.array(uuid).optional(),
	labels: z.record(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	sort_order: z.number().int().nonnegative().default(0),
	version: z.string().optional(),
	reference_docs: z.array(z.string().url()).optional(),
	form_schema: jsonbSettings,
	metadata: jsonbMetadata,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
});

export type SettingsDefinition = z.infer<typeof SettingsDefinitionsSchema>;

export const CreateSettingsDefinitionSchema = SettingsDefinitionsSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
});

export type CreateSettingsDefinition = z.infer<typeof CreateSettingsDefinitionSchema>;

export const UpdateSettingsDefinitionSchema = SettingsDefinitionsSchema.partial().extend({
	id: uuid,
});

export type UpdateSettingsDefinition = z.infer<typeof UpdateSettingsDefinitionSchema>;
