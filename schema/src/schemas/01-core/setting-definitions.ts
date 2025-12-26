/**
 * SettingDefinitions Schema
 * @table setting_definitions
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid
} from '../../shared/base-schemas.js';

/**
 * Complete SettingDefinitions schema
 */
export const SettingDefinitionsSchema = z.object({
  setting_id: uuid,
  category_id: uuid,
  setting_key: z.string(),
  setting_name: z.string(),
  description: z.string(),
  storage_level: z.string(),
  data_type: z.string(),
  default_value: z.record(z.unknown()).optional(),
  allowed_values: z.record(z.unknown()).optional(),
  documentation: z.string().optional(),
  is_required: z.boolean(),
  is_active: z.boolean(),
  tags: z.array(z.string()).optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
});

export type SettingDefinitions = z.infer<typeof SettingDefinitionsSchema>;

/**
 * Schema for creating a new setting definitions
 */
export const CreateSettingDefinitionsSchema = SettingDefinitionsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateSettingDefinitions = z.infer<typeof CreateSettingDefinitionsSchema>;

/**
 * Schema for updating a setting definitions
 */
export const UpdateSettingDefinitionsSchema = SettingDefinitionsSchema.partial();

export type UpdateSettingDefinitions = z.infer<typeof UpdateSettingDefinitionsSchema>;
