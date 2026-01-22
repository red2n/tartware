/**
 * DEV DOC
 * Module: api/system-session.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";
import { AdminUserSchema } from "./admin-auth.js";

export const SystemAdminTokenSchema = z.object({
	accessToken: z.string(),
	tokenType: z.literal("Bearer"),
	scope: z.literal("SYSTEM_ADMIN"),
	sessionId: z.string(),
	expiresIn: z.number().int().positive(),
	admin: AdminUserSchema.optional(),
});
export type SystemAdminToken = z.infer<typeof SystemAdminTokenSchema>;

export const ImpersonationTokenSchema = z.object({
	accessToken: z.string(),
	tokenType: z.literal("Bearer"),
	scope: z.literal("TENANT_IMPERSONATION"),
	expiresIn: z.number().int().positive(),
	expiresAt: z.string().optional(),
});
export type ImpersonationToken = z.infer<typeof ImpersonationTokenSchema>;

export const TenantContextSchema = z.object({
	tenantId: uuid,
	propertyId: uuid.optional(),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;
