/**
 * DEV DOC
 * Module: schemas/08-settings/settings-sections.ts
 * Description: Settings Sections Schema
 * Table: settings_sections
 * Category: 08-settings
 * Primary exports: SettingsSectionsSchema, CreateSettingsSectionSchema, UpdateSettingsSectionSchema
 * @table settings_sections
 * @category 08-settings
 * Ownership: Schema package
 */

/**
 * Settings Sections Schema
 * @table settings_sections
 * @category 08-settings
 * @synchronized 2025-11-13
 */

import { z } from "zod";

import { uuid, jsonbMetadata } from "../../shared/base-schemas.js";

/**
 * Mid-level grouping of settings within a category (e.g., "Role-Based Access Control")
 */
export const SettingsSectionsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	category_id: uuid,
	code: z
		.string()
		.min(2)
		.max(64)
		.regex(/^[A-Z0-9_]+$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(3).max(160),
	description: z.string().max(2048).optional(),
	icon: z.string().max(64).optional(),
	sort_order: z.number().int().nonnegative().default(0),
	is_active: z.boolean().default(true),
	tags: z.array(z.string()).optional(),
	metadata: jsonbMetadata,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
});

export type SettingsSection = z.infer<typeof SettingsSectionsSchema>;

export const CreateSettingsSectionSchema = SettingsSectionsSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
});

export type CreateSettingsSection = z.infer<typeof CreateSettingsSectionSchema>;

export const UpdateSettingsSectionSchema = SettingsSectionsSchema.partial().extend({
	id: uuid,
});

export type UpdateSettingsSection = z.infer<typeof UpdateSettingsSectionSchema>;
