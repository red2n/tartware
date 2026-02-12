/**
 * DEV DOC
 * Module: api/auth.ts
 * Purpose: Tenant authentication API schemas (login, MFA, password, context)
 * Ownership: Schema package
 */

import { z } from "zod";

import { PublicUserSchema } from "../schemas/01-core/users.js";
import { uuid } from "../shared/base-schemas.js";
import { TenantRoleEnum } from "../shared/enums.js";

// -----------------------------------------------------------------------------
// Auth Context
// -----------------------------------------------------------------------------

/** Membership entry in auth context. */
export const AuthMembershipSchema = z.object({
	tenant_id: uuid,
	tenant_name: z.string().min(1).optional(),
	role: TenantRoleEnum,
	is_active: z.boolean(),
	permissions: z.record(z.unknown()),
});

export type AuthMembership = z.infer<typeof AuthMembershipSchema>;

/** Auth context response (current user's memberships and authorized tenants). */
export const AuthContextResponseSchema = z.object({
	is_authenticated: z.boolean(),
	user_id: uuid.nullable(),
	memberships: z.array(AuthMembershipSchema),
	authorized_tenants: z.array(uuid),
	header_hint: z.object({
		header: z.literal("Authorization"),
		description: z.string(),
	}),
});

export type AuthContextResponse = z.infer<typeof AuthContextResponseSchema>;

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

/** Login request body. */
export const LoginRequestSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(8, "Password is required"),
	mfa_code: z
		.string()
		.regex(/^\d{6}$/, "MFA code must be a 6-digit value")
		.optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Login response with user profile, memberships, and access token. */
export const LoginResponseSchema = PublicUserSchema.pick({
	id: true,
	username: true,
	email: true,
	first_name: true,
	last_name: true,
	is_active: true,
}).extend({
	memberships: z.array(AuthMembershipSchema),
	access_token: z.string(),
	token_type: z.literal("Bearer"),
	expires_in: z.number().positive(),
	must_change_password: z.boolean(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// -----------------------------------------------------------------------------
// Password Change
// -----------------------------------------------------------------------------

/**
 * Base change-password request schema.
 * Route files may apply additional `.refine()` for app-specific config rules.
 */
export const ChangePasswordRequestSchema = z
	.object({
		current_password: z.string().min(8, "Current password is required"),
		new_password: z
			.string()
			.min(8, "New password must be at least 8 characters"),
	})
	.refine(
		(data) => data.current_password !== data.new_password,
		"New password must be different from current password",
	);

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

// -----------------------------------------------------------------------------
// MFA
// -----------------------------------------------------------------------------

/** MFA enrollment response. */
export const MfaEnrollResponseSchema = z.object({
	secret: z.string(),
	otpauth_url: z.string(),
	message: z.string(),
});

export type MfaEnrollResponse = z.infer<typeof MfaEnrollResponseSchema>;

/** MFA verification request body. */
export const MfaVerifyRequestSchema = z.object({
	mfa_code: z.string().regex(/^\d{6}$/, "MFA code must be a 6-digit value"),
});

export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequestSchema>;

/** MFA verification response. */
export const MfaVerifyResponseSchema = z.object({
	message: z.string(),
});

export type MfaVerifyResponse = z.infer<typeof MfaVerifyResponseSchema>;
