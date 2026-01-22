/**
 * DEV DOC
 * Module: schemas/01-core/setting-categories.ts
 * Description: SettingCategories Schema
 * Table: setting_categories
 * Category: 01-core
 * Primary exports: SettingCategoriesSchema, CreateSettingCategoriesSchema, UpdateSettingCategoriesSchema
 * @table setting_categories
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * SettingCategories Schema
 * @table setting_categories
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid
} from '../../shared/base-schemas.js';

/**
 * Complete SettingCategories schema
 */
export const SettingCategoriesSchema = z.object({
  category_id: uuid,
  category_key: z.string(),
  display_name: z.string(),
  description: z.string(),
  documentation: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
});

export type SettingCategories = z.infer<typeof SettingCategoriesSchema>;

/**
 * Schema for creating a new setting categories
 */
export const CreateSettingCategoriesSchema = SettingCategoriesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateSettingCategories = z.infer<typeof CreateSettingCategoriesSchema>;

/**
 * Schema for updating a setting categories
 */
export const UpdateSettingCategoriesSchema = SettingCategoriesSchema.partial();

export type UpdateSettingCategories = z.infer<typeof UpdateSettingCategoriesSchema>;
