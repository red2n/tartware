/**
 * DEV DOC
 * Module: schemas/01-core/users.ts
 * Description: Users Schema
 * Table: users
 * Category: 01-core
 * Primary exports: UserSchema, PublicUserSchema, UserTenantMembershipSchema, UserWithTenantsSchema, CreateUserSchema, UpdateUserSchema
 * @table users
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Users Schema
 * @table users
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import {
	uuid,
	email,
	phoneNumber,
	url,
	jsonbMetadata,
	auditTimestamps,
	softDelete,
	nonEmptyString,
} from "../../shared/base-schemas.js";

const JsonbObject = z.record(z.unknown()).default({});

/**
 * Complete user schema (internal view)
 */
export const UserSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	username: nonEmptyString.max(150),
	email: email,
	password_hash: z.string().min(20).describe("BCrypt hash"),
	first_name: z.string().max(150),
	last_name: z.string().max(150),
	phone: phoneNumber.optional(),
	avatar_url: url.optional(),
	is_active: z.boolean().default(true),
	is_verified: z.boolean().default(false),
	email_verified_at: z.coerce.date().optional(),
	last_login_at: z.coerce.date().optional(),
	failed_login_attempts: z.number().int().nonnegative().default(0),
	locked_until: z.coerce.date().optional(),
	mfa_secret: z.string().min(16).optional(),
	mfa_enabled: z.boolean().default(false),
	mfa_backup_codes: z.array(z.string().min(8)).default([]),
	password_rotated_at: z.coerce.date().optional(),
	password_reset_token: z.string().optional(),
	password_reset_expires: z.coerce.date().optional(),
	preferences: JsonbObject.describe("UI and notification preferences"),
	metadata: jsonbMetadata,
	...auditTimestamps,
	...softDelete,
	version: z.bigint().default(BigInt(0)),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Public user schema (safe for API responses)
 */
export const PublicUserSchema = UserSchema.pick({
	id: true,
	username: true,
	email: true,
	first_name: true,
	last_name: true,
	phone: true,
	avatar_url: true,
	is_active: true,
	is_verified: true,
	email_verified_at: true,
	last_login_at: true,
	preferences: true,
	metadata: true,
	created_at: true,
	updated_at: true,
	version: true,
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

/**
 * User with tenant memberships (for admin dashboards)
 */
export const UserTenantMembershipSchema = z.object({
	tenant_id: uuid,
	tenant_name: nonEmptyString.max(200).optional(),
	role: z.string().min(1),
	is_active: z.boolean().default(true),
});

export type UserTenantMembership = z.infer<typeof UserTenantMembershipSchema>;

export const UserWithTenantsSchema = PublicUserSchema.extend({
	tenants: z.array(UserTenantMembershipSchema).optional(),
});

export type UserWithTenants = z.infer<typeof UserWithTenantsSchema>;

export const CreateUserSchema = UserSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	deleted_at: true,
	version: true,
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = UserSchema.partial().extend({
	id: uuid,
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;
