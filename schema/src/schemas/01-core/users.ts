/**
 * Users Schema
 * @table users
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid
} from '../../shared/base-schemas.js';

/**
 * Complete Users schema
 */
export const UsersSchema = z.object({
  id: uuid,
  username: z.string(),
  email: z.string(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  is_active: z.boolean(),
  is_verified: z.boolean(),
  email_verified_at: z.coerce.date().optional(),
  last_login_at: z.coerce.date().optional(),
  failed_login_attempts: z.number().int().optional(),
  locked_until: z.coerce.date().optional(),
  password_reset_token: z.string().optional(),
  password_reset_expires: z.coerce.date().optional(),
  preferences: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: z.string().optional(),
  version: z.bigint().optional(),
});

export type Users = z.infer<typeof UsersSchema>;

/**
 * Schema for creating a new users
 */
export const CreateUsersSchema = UsersSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateUsers = z.infer<typeof CreateUsersSchema>;

/**
 * Schema for updating a users
 */
export const UpdateUsersSchema = UsersSchema.partial();

export type UpdateUsers = z.infer<typeof UpdateUsersSchema>;
