/**
 * DEV DOC
 * Module: schemas/01-core/role-screen-permissions.ts
 * Description: RoleScreenPermissions Schema
 * Table: role_screen_permissions
 * Category: 01-core
 * Primary exports: RoleScreenPermissionSchema, ScreenPermissionEntrySchema, UpsertScreenPermissionsSchema
 * @table role_screen_permissions
 * @category 01-core
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";
import { TenantRoleEnum } from "../../shared/enums.js";

/**
 * Complete RoleScreenPermission row schema.
 * @table role_screen_permissions
 */
export const RoleScreenPermissionSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	role: TenantRoleEnum,
	screen_key: z.string().min(1).max(100),
	is_visible: z.boolean(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().max(100).optional(),
	updated_by: z.string().max(100).optional(),
});
export type RoleScreenPermission = z.infer<typeof RoleScreenPermissionSchema>;

/**
 * A single screen permission entry (screen_key + visibility).
 * Used in both API responses and upsert payloads.
 */
export const ScreenPermissionEntrySchema = z.object({
	screen_key: z.string().min(1).max(100),
	is_visible: z.boolean(),
});
export type ScreenPermissionEntry = z.infer<typeof ScreenPermissionEntrySchema>;

/**
 * Payload for upserting screen permissions for a specific role.
 */
export const UpsertScreenPermissionsSchema = z.object({
	role: TenantRoleEnum,
	screens: z.array(ScreenPermissionEntrySchema).min(1),
});
export type UpsertScreenPermissions = z.infer<
	typeof UpsertScreenPermissionsSchema
>;

/**
 * Response shape: list of screen permissions for a given role.
 */
export const RoleScreenPermissionsResponseSchema = z.object({
	role: TenantRoleEnum,
	screens: z.array(ScreenPermissionEntrySchema),
});
export type RoleScreenPermissionsResponse = z.infer<
	typeof RoleScreenPermissionsResponseSchema
>;

/**
 * Response shape: all roles' screen permissions (for admin overview).
 */
export const AllRoleScreenPermissionsResponseSchema = z.object({
	permissions: z.array(RoleScreenPermissionsResponseSchema),
});
export type AllRoleScreenPermissionsResponse = z.infer<
	typeof AllRoleScreenPermissionsResponseSchema
>;
