/**
 * DEV DOC
 * Module: schemas/01-core/user-settings.ts
 * Description: UserSettings Schema
 * Table: user_settings
 * Category: 01-core
 * Primary exports: UserSettingsSchema, CreateUserSettingsSchema, UpdateUserSettingsSchema
 * @table user_settings
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * UserSettings Schema
 * @table user_settings
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid
} from '../../shared/base-schemas.js';

/**
 * Complete UserSettings schema
 */
export const UserSettingsSchema = z.object({
  user_setting_id: uuid,
  tenant_id: uuid,
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: z.string().max(100).optional(),
  user_id: uuid,
  setting_id: uuid,
  value: z.record(z.unknown()),
  notes: z.string().optional(),
  documentation: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

/**
 * Schema for creating a new user settings
 */
export const CreateUserSettingsSchema = UserSettingsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateUserSettings = z.infer<typeof CreateUserSettingsSchema>;

/**
 * Schema for updating a user settings
 */
export const UpdateUserSettingsSchema = UserSettingsSchema.partial();

export type UpdateUserSettings = z.infer<typeof UpdateUserSettingsSchema>;
