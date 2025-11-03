/**
 * User Schema - System users and authentication
 * @table users
 * @category 01-core
 * @synchronized 2025-11-03
 */

import { z } from 'zod';

import {
  uuid,
  email,
  phoneNumber,
  url,
  auditTimestamps,
  softDelete,
  jsonbMetadata,
  nonEmptyString,
  nonNegativeInt,
} from '../../shared/base-schemas.js';

/**
 * User preferences JSONB schema
 */
export const UserPreferencesSchema = z.object({
  language: z.string().length(2).default('en'),
  timezone: z.string().default('UTC'),
  currency: z.string().length(3).default('USD'),
  dateFormat: z.string().default('YYYY-MM-DD'),
  timeFormat: z.string().default('HH:mm'),
  notifications: z
    .object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(true),
    })
    .default({ email: true, sms: false, push: true }),
});

/**
 * Complete User schema
 */
export const UserSchema = z.object({
  id: uuid.describe('Primary key'),
  username: nonEmptyString.max(100).describe('Unique username'),
  email: email.describe('User email address'),
  password_hash: z.string().max(255).describe('Hashed password'),
  first_name: nonEmptyString.max(100).describe('First name'),
  last_name: nonEmptyString.max(100).describe('Last name'),
  phone: phoneNumber.optional().describe('Phone number'),
  avatar_url: url.optional().describe('Profile picture URL'),
  is_active: z.boolean().default(true).describe('Account active status'),
  is_verified: z.boolean().default(false).describe('Email verification status'),
  email_verified_at: z.coerce.date().optional().describe('Email verification timestamp'),
  last_login_at: z.coerce.date().optional().describe('Last login timestamp'),
  failed_login_attempts: nonNegativeInt.default(0).describe('Failed login counter'),
  locked_until: z.coerce.date().optional().describe('Account lock expiration'),
  password_reset_token: z.string().max(255).optional().describe('Password reset token'),
  password_reset_expires: z.coerce.date().optional().describe('Token expiration'),
  preferences: UserPreferencesSchema.describe('User preferences'),
  metadata: jsonbMetadata,
  ...auditTimestamps,
  ...softDelete,
  version: z.bigint().default(BigInt(0)).describe('Optimistic locking version'),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Schema for creating a new user (password handling)
 */
export const CreateUserSchema = UserSchema.omit({
  id: true,
  password_hash: true,
  email_verified_at: true,
  last_login_at: true,
  failed_login_attempts: true,
  locked_until: true,
  password_reset_token: true,
  password_reset_expires: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
  deleted_at: true,
  version: true,
}).extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .describe('Plain text password (will be hashed)'),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

/**
 * Schema for updating user (excludes sensitive fields)
 */
export const UpdateUserSchema = UserSchema.omit({
  id: true,
  password_hash: true,
  email_verified_at: true,
  last_login_at: true,
  failed_login_attempts: true,
  locked_until: true,
  password_reset_token: true,
  password_reset_expires: true,
  created_at: true,
  created_by: true,
  deleted_at: true,
})
  .partial()
  .extend({
    id: uuid,
  });

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

/**
 * User login schema
 */
export const UserLoginSchema = z.object({
  username_or_email: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type UserLogin = z.infer<typeof UserLoginSchema>;

/**
 * User without sensitive fields (for API responses)
 */
export const PublicUserSchema = UserSchema.omit({
  password_hash: true,
  password_reset_token: true,
  password_reset_expires: true,
  failed_login_attempts: true,
  locked_until: true,
  deleted_at: true,
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

/**
 * User with tenant associations (for API responses)
 */
export const UserWithTenantsSchema = PublicUserSchema.extend({
  tenants: z
    .array(
      z.object({
        tenant_id: uuid,
        tenant_name: z.string(),
        role: z.string(),
        is_active: z.boolean(),
      })
    )
    .optional(),
});

export type UserWithTenants = z.infer<typeof UserWithTenantsSchema>;
