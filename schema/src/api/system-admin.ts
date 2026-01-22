/**
 * DEV DOC
 * Module: api/system-admin.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { TenantWithRelationsSchema } from "../schemas/01-core/tenants.js";
import { UserWithTenantsSchema } from "../schemas/01-core/users.js";
import {
	email,
	nonEmptyString,
	phoneNumber,
	uuid,
	url,
} from "../shared/base-schemas.js";
import { TenantRoleEnum, TenantTypeEnum } from "../shared/enums.js";

export const TenantCollectionResponseSchema = z.object({
	tenants: z.array(TenantWithRelationsSchema),
	count: z.number().int().nonnegative().optional(),
});
export type TenantCollectionResponse = z.infer<typeof TenantCollectionResponseSchema>;

export const TenantListResponseSchema = z.object({
	tenants: z.array(TenantWithRelationsSchema),
	count: z.number().int().nonnegative(),
});
export type TenantListResponse = z.infer<typeof TenantListResponseSchema>;

export const UserListResponseSchema = z.array(UserWithTenantsSchema);
export type UserListResponse = z.infer<typeof UserListResponseSchema>;

export const CreateUserRequestSchema = z.object({
	username: nonEmptyString.max(150),
	email,
	password: z.string().min(8),
	first_name: nonEmptyString.max(150),
	last_name: nonEmptyString.max(150),
	phone: phoneNumber.optional(),
	tenant_id: uuid.optional(),
	role: TenantRoleEnum.optional(),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const CreateUserResponseSchema = z.object({
	id: uuid,
	username: nonEmptyString.max(150),
	email,
	message: z.string(),
});
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

export const CreateTenantRequestSchema = z.object({
	name: nonEmptyString.max(200),
	slug: nonEmptyString
		.max(200)
		.regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
	type: TenantTypeEnum.optional(),
	email,
	phone: phoneNumber.optional(),
	website: url.optional(),
});
export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>;

export const CreateTenantResponseSchema = z.object({
	id: uuid,
	name: nonEmptyString.max(200),
	slug: nonEmptyString.max(200),
	message: z.string(),
});
export type CreateTenantResponse = z.infer<typeof CreateTenantResponseSchema>;
