/**
 * DEV DOC
 * Module: schemas/08-settings/settings-categories.ts
 * Description: Settings Categories Schema
 * Table: settings_categories
 * Category: 08-settings
 * Primary exports: SettingsCategoriesSchema, CreateSettingsCategorySchema, UpdateSettingsCategorySchema
 * @table settings_categories
 * @category 08-settings
 * Ownership: Schema package
 */

/**
 * Settings Categories Schema
 * @table settings_categories
 * @category 08-settings
 * @synchronized 2025-11-13
 */

import { z } from "zod";

import { uuid, jsonbMetadata } from "../../shared/base-schemas.js";

/**
 * Catalog of top-level settings categories (e.g., Admin & User Management)
 */
export const SettingsCategoriesSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	code: z
		.string()
		.min(2)
		.max(64)
		.regex(/^[A-Z0-9_]+$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(3).max(120),
	description: z.string().max(1024).optional(),
	icon: z.string().max(64).optional(),
	color: z.string().max(32).optional(),
	sort_order: z.number().int().nonnegative().default(0),
	is_active: z.boolean().default(true),
	tags: z.array(z.string()).optional(),
	metadata: jsonbMetadata,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
});

export type SettingsCategory = z.infer<typeof SettingsCategoriesSchema>;

/**
 * Schema for creating a new settings category
 */
export const CreateSettingsCategorySchema = SettingsCategoriesSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
});

export type CreateSettingsCategory = z.infer<typeof CreateSettingsCategorySchema>;

/**
 * Schema for updating an existing settings category
 */
export const UpdateSettingsCategorySchema = SettingsCategoriesSchema.partial().extend({
	id: uuid,
});

export type UpdateSettingsCategory = z.infer<typeof UpdateSettingsCategorySchema>;
