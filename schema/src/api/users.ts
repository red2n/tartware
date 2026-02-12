/**
 * DEV DOC
 * Module: api/users.ts
 * Purpose: Tenant-level user management API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { PublicUserSchema } from "../schemas/01-core/users.js";
import { UserWithTenantsSchema } from "../schemas/01-core/users.js";
import { uuid } from "../shared/base-schemas.js";
import { TenantRoleEnum } from "../shared/enums.js";

// -----------------------------------------------------------------------------
// User List (tenant-scoped)
// -----------------------------------------------------------------------------

/** Query schema for listing tenant users. */
export const UserListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
	tenant_id: uuid,
});

export type UserListQuery = z.infer<typeof UserListQuerySchema>;

/** User list response (version serialized as string). */
export const TenantUserListResponseSchema = z.array(
	PublicUserSchema.extend({
		version: z.string(),
	}),
);

export type TenantUserListResponse = z.infer<typeof TenantUserListResponseSchema>;

// -----------------------------------------------------------------------------
// Create Tenant User
// -----------------------------------------------------------------------------

/** Body schema for creating / inviting a tenant user. */
export const CreateTenantUserSchema = z.object({
	tenant_id: uuid,
	username: z.string().min(3).max(50),
	email: z.string().email(),
	password: z.string().min(8).optional(),
	first_name: z.string().min(1).max(100),
	last_name: z.string().min(1).max(100),
	phone: z.string().optional(),
	role: TenantRoleEnum,
});

export type CreateTenantUser = z.infer<typeof CreateTenantUserSchema>;

/** Response after creating a tenant user. */
export const CreateTenantUserResponseSchema = z.object({
	id: uuid,
	username: z.string(),
	email: z.string().email(),
	message: z.string(),
});

export type CreateTenantUserResponse = z.infer<typeof CreateTenantUserResponseSchema>;

// -----------------------------------------------------------------------------
// Reset Password
// -----------------------------------------------------------------------------

/** Body schema for resetting a tenant user's password. */
export const ResetTenantUserPasswordSchema = z.object({
	tenant_id: uuid,
	user_id: uuid,
	new_password: z.string().min(8).optional(),
});

export type ResetTenantUserPassword = z.infer<typeof ResetTenantUserPasswordSchema>;

/** Response after resetting a password. */
export const ResetTenantUserPasswordResponseSchema = z.object({
	user_id: uuid,
	message: z.string(),
});

export type ResetTenantUserPasswordResponse = z.infer<typeof ResetTenantUserPasswordResponseSchema>;

// -----------------------------------------------------------------------------
// System User List (system admin scope)
// -----------------------------------------------------------------------------

/** Query schema for system admin user listing. */
export const SystemUserListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(500).default(100),
	offset: z.coerce.number().int().nonnegative().default(0),
	tenant_id: uuid.optional(),
});

export type SystemUserListQuery = z.infer<typeof SystemUserListQuerySchema>;

/** System user list response. */
export const SystemUserListResponseSchema = z.object({
	users: z.array(
		UserWithTenantsSchema.extend({
			version: z.string(),
		}),
	),
	count: z.number().int().nonnegative(),
	limit: z.number().int().positive(),
	offset: z.number().int().nonnegative(),
});

export type SystemUserListResponse = z.infer<typeof SystemUserListResponseSchema>;
