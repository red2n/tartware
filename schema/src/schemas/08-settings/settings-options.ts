/**
 * DEV DOC
 * Module: schemas/08-settings/settings-options.ts
 * Description: Settings Options Schema
 * Table: settings_options
 * Category: 08-settings
 * Primary exports: SettingsOptionsSchema, CreateSettingsOptionSchema, UpdateSettingsOptionSchema
 * @table settings_options
 * @category 08-settings
 * Ownership: Schema package
 */

/**
 * Settings Options Schema
 * @table settings_options
 * @category 08-settings
 * @synchronized 2025-11-13
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

/**
 * Discrete option values for enumerated settings
 */
export const SettingsOptionsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	setting_id: uuid,
	value: z.string().min(1).max(128),
	label: z.string().min(1).max(160),
	description: z.string().max(1024).optional(),
	icon: z.string().max(64).optional(),
	color: z.string().max(32).optional(),
	sort_order: z.number().int().nonnegative().default(0),
	is_default: z.boolean().default(false),
	is_active: z.boolean().default(true),
	metadata: jsonbMetadata,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
});

export type SettingsOption = z.infer<typeof SettingsOptionsSchema>;

export const CreateSettingsOptionSchema = SettingsOptionsSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
});

export type CreateSettingsOption = z.infer<typeof CreateSettingsOptionSchema>;

export const UpdateSettingsOptionSchema = SettingsOptionsSchema.partial().extend({
	id: uuid,
});

export type UpdateSettingsOption = z.infer<typeof UpdateSettingsOptionSchema>;
