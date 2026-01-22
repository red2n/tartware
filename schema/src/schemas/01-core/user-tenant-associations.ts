/**
 * DEV DOC
 * Module: schemas/01-core/user-tenant-associations.ts
 * Description: UserTenantAssociations Schema
 * Table: user_tenant_associations
 * Category: 01-core
 * Primary exports: UserTenantAssociationSchema, CreateUserTenantAssociationSchema, UpdateUserTenantAssociationSchema, UserTenantAssociationWithDetailsSchema
 * @table user_tenant_associations
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * UserTenantAssociations Schema
 * @table user_tenant_associations
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import { uuid, jsonbMetadata, auditTimestamps } from "../../shared/base-schemas.js";
import { TenantRoleEnum, TenantStatusEnum } from "../../shared/enums.js";

/**
 * Complete UserTenantAssociation schema
 */
export const UserTenantAssociationSchema = z.object({
	id: uuid,
	user_id: uuid,
	tenant_id: uuid,
	role: TenantRoleEnum,
	is_active: z.boolean().default(true),
	permissions: jsonbMetadata.describe("Role overrides / grants"),
	valid_from: z.coerce.date().optional(),
	valid_until: z.coerce.date().optional(),
	metadata: jsonbMetadata,
	...auditTimestamps,
	version: z.bigint().default(BigInt(0)),
});

export type UserTenantAssociation = z.infer<typeof UserTenantAssociationSchema>;

export const CreateUserTenantAssociationSchema = UserTenantAssociationSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	version: true,
});

export type CreateUserTenantAssociation = z.infer<typeof CreateUserTenantAssociationSchema>;

export const UpdateUserTenantAssociationSchema = UserTenantAssociationSchema.partial().extend({
	id: uuid,
});

export type UpdateUserTenantAssociation = z.infer<typeof UpdateUserTenantAssociationSchema>;

/**
 * Lightweight summaries for nested responses
 */
const UserSummarySchema = z.object({
	username: z.string().min(1),
	email: z.string().email(),
	first_name: z.string().optional(),
	last_name: z.string().optional(),
});

const TenantSummarySchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	status: TenantStatusEnum,
});

export const UserTenantAssociationWithDetailsSchema = UserTenantAssociationSchema.extend({
	user: UserSummarySchema.optional(),
	tenant: TenantSummarySchema.optional(),
});

export type UserTenantAssociationWithDetails = z.infer<
	typeof UserTenantAssociationWithDetailsSchema
>;
