/**
 * DEV DOC
 * Module: api/admin-auth.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { nonEmptyString, uuid } from "../shared/base-schemas.js";

export const AdminUserSchema = z.object({
	id: uuid.optional(),
	username: nonEmptyString.max(150).optional(),
	role: z.string().min(1).optional(),
	first_name: z.string().min(1).optional(),
	last_name: z.string().min(1).optional(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const SystemAdminLoginRequestSchema = z.object({
	username: nonEmptyString.max(150),
	password: z.string().min(1),
	mfa_code: z.string().nullable().optional(),
	device_fingerprint: z.string().min(8),
});
export type SystemAdminLoginRequest = z.infer<typeof SystemAdminLoginRequestSchema>;

export const SystemAdminLoginResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.literal("Bearer"),
	expires_in: z.number().int().positive(),
	scope: z.literal("SYSTEM_ADMIN"),
	session_id: z.string(),
	admin: AdminUserSchema.optional(),
});
export type SystemAdminLoginResponse = z.infer<typeof SystemAdminLoginResponseSchema>;

export const SystemAdminBreakGlassRequestSchema = z.object({
	username: nonEmptyString.max(150),
	break_glass_code: z.string().min(8),
	reason: z.string().min(10),
	ticket_id: z.string().nullable().optional(),
	device_fingerprint: z.string().min(8),
});
export type SystemAdminBreakGlassRequest = z.infer<typeof SystemAdminBreakGlassRequestSchema>;

export const SystemAdminBreakGlassResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.literal("Bearer"),
	expires_in: z.number().int().positive(),
	scope: z.literal("SYSTEM_ADMIN"),
	session_id: z.string(),
	admin: AdminUserSchema,
});
export type SystemAdminBreakGlassResponse = z.infer<typeof SystemAdminBreakGlassResponseSchema>;

export const SystemAdminImpersonationRequestSchema = z.object({
	tenant_id: uuid,
	user_id: uuid,
	reason: z.string().min(1),
	ticket_id: z.string().min(1),
});
export type SystemAdminImpersonationRequest = z.infer<typeof SystemAdminImpersonationRequestSchema>;

export const SystemAdminImpersonationResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.literal("Bearer"),
	scope: z.literal("TENANT_IMPERSONATION"),
	expires_in: z.number().int().positive(),
});
export type SystemAdminImpersonationResponse = z.infer<typeof SystemAdminImpersonationResponseSchema>;
