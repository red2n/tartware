/**
 * DEV DOC
 * Module: api/associations.ts
 * Purpose: User-tenant association management API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { UserTenantAssociationWithDetailsSchema } from "../schemas/01-core/user-tenant-associations.js";
import { uuid } from "../shared/base-schemas.js";
import { TenantRoleEnum } from "../shared/enums.js";

// -----------------------------------------------------------------------------
// List
// -----------------------------------------------------------------------------

/** Query schema for listing user-tenant associations. */
export const AssociationListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
	tenant_id: uuid,
	user_id: uuid.optional(),
	role: TenantRoleEnum.optional(),
	is_active: z.coerce.boolean().optional(),
});

export type AssociationListQuery = z.infer<typeof AssociationListQuerySchema>;

/** Association list response (version serialized as string). */
export const AssociationListResponseSchema = z.array(
	UserTenantAssociationWithDetailsSchema.extend({
		version: z.string(),
	}),
);

export type AssociationListResponse = z.infer<
	typeof AssociationListResponseSchema
>;

// -----------------------------------------------------------------------------
// Role Update
// -----------------------------------------------------------------------------

/** Body schema for updating a user's role within a tenant. */
export const AssociationRoleUpdateSchema = z.object({
	tenant_id: uuid,
	user_id: uuid,
	role: TenantRoleEnum,
});

export type AssociationRoleUpdate = z.infer<typeof AssociationRoleUpdateSchema>;

/** Response after updating a role. */
export const AssociationRoleUpdateResponseSchema = z.object({
	id: uuid,
	user_id: uuid,
	tenant_id: uuid,
	role: TenantRoleEnum,
	is_active: z.boolean(),
	message: z.string(),
});

export type AssociationRoleUpdateResponse = z.infer<
	typeof AssociationRoleUpdateResponseSchema
>;

// -----------------------------------------------------------------------------
// Command Permission Grants
// -----------------------------------------------------------------------------

/**
 * Body schema for setting the per-command grants on one membership.
 *
 * Both lists are absolute, not deltas: what is sent is what the membership
 * holds afterwards, so an empty `allow` revokes every grant. A patch semantics
 * here would make "remove this one grant" a read-modify-write race between two
 * administrators.
 */
export const AssociationCommandGrantsUpdateSchema = z.object({
	tenant_id: uuid,
	user_id: uuid,
	/** Commands this membership may run regardless of its role. */
	allow: z.array(z.string().min(1)).max(50).default([]),
	/** Commands this membership may not run even though its role reaches them. */
	deny: z.array(z.string().min(1)).max(50).default([]),
});

export type AssociationCommandGrantsUpdate = z.infer<
	typeof AssociationCommandGrantsUpdateSchema
>;

/** Response after setting per-command grants. */
export const AssociationCommandGrantsResponseSchema = z.object({
	user_id: uuid,
	tenant_id: uuid,
	allow: z.array(z.string()),
	deny: z.array(z.string()),
	message: z.string(),
});

export type AssociationCommandGrantsResponse = z.infer<
	typeof AssociationCommandGrantsResponseSchema
>;

// -----------------------------------------------------------------------------
// Status Update
// -----------------------------------------------------------------------------

/** Body schema for activating / deactivating a user's tenant access. */
export const AssociationStatusUpdateSchema = z.object({
	tenant_id: uuid,
	user_id: uuid,
	is_active: z.boolean(),
});

export type AssociationStatusUpdate = z.infer<
	typeof AssociationStatusUpdateSchema
>;

/** Response after updating association status. */
export const AssociationStatusUpdateResponseSchema = z.object({
	id: uuid,
	user_id: uuid,
	tenant_id: uuid,
	role: TenantRoleEnum,
	is_active: z.boolean(),
	message: z.string(),
});

export type AssociationStatusUpdateResponse = z.infer<
	typeof AssociationStatusUpdateResponseSchema
>;

// -----------------------------------------------------------------------------
// Tenant Membership Row / Mapped Shape
// -----------------------------------------------------------------------------

/** Raw row shape from user_tenant_associations + tenants join query. */
export type TenantMembershipRow = {
	tenant_id: string;
	tenant_name: string;
	role: string;
	is_active: boolean;
	permissions: Record<string, unknown> | null;
	modules: string[] | null;
};

/** Mapped tenant membership for a user (camelCase, non-nullable). */
export type TenantMembership = {
	tenantId: string;
	tenantName: string;
	role: z.infer<typeof TenantRoleEnum>;
	isActive: boolean;
	permissions: Record<string, unknown>;
	modules: string[];
};
