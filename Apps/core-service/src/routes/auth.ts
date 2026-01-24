import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { PublicUserSchema, TenantRoleEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { authenticator } from "otplib";
import { z } from "zod";

import { config } from "../config.js";
import { pool } from "../lib/db.js";
import { authenticateUser, changeUserPassword } from "../services/auth-service.js";
import {
  TENANT_AUTH_MFA_PROFILE_SQL,
  TENANT_AUTH_UPDATE_MFA_SQL,
} from "../sql/tenant-auth-queries.js";
import { sanitizeForJson } from "../utils/sanitize.js";

// Use schemas from @tartware/schemas
const AuthMembershipSchema = z.object({
  tenant_id: z.string().uuid(),
  tenant_name: z.string().min(1).optional(),
  role: TenantRoleEnum,
  is_active: z.boolean(),
  permissions: z.record(z.unknown()),
});

const AuthContextResponseSchema = z.object({
  is_authenticated: z.boolean(),
  user_id: z.string().uuid().nullable(),
  memberships: z.array(AuthMembershipSchema),
  authorized_tenants: z.array(z.string().uuid()),
  header_hint: z.object({
    header: z.literal("Authorization"),
    description: z.string(),
  }),
});

// Login request schema
const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password is required"),
  mfa_code: z
    .string()
    .regex(/^\d{6}$/, "MFA code must be a 6-digit value")
    .optional(),
});

// Login response using PublicUserSchema from @tartware/schemas
const LoginResponseSchema = PublicUserSchema.pick({
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

const ChangePasswordRequestSchema = z
  .object({
    current_password: z.string().min(8, "Current password is required"),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .refine((value) => value !== config.auth.defaultPassword, {
        message: "New password cannot be the default password.",
      }),
  })
  .refine(
    (data) => data.current_password !== data.new_password,
    "New password must be different from current password",
  );

const AUTH_TAG = "Auth";
const AUTH_ERROR_CODES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid credentials",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  THROTTLED: "THROTTLED",
  MFA_REQUIRED: "MFA_REQUIRED",
  MFA_INVALID: "MFA_INVALID",
  MFA_NOT_ENROLLED: "MFA_NOT_ENROLLED",
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid username or password.",
  ACCOUNT_INACTIVE: "This account is not active.",
  ACCOUNT_LOCKED: "Account temporarily locked due to failed attempts.",
  THROTTLED: "Too many attempts. Please retry later.",
  MFA_REQUIRED: "Multi-factor authentication code required.",
  MFA_INVALID: "Invalid multi-factor authentication code.",
  MFA_NOT_ENROLLED: "MFA enrollment required before accessing tenant resources.",
};

const AUTH_ERROR_STATUS: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  ACCOUNT_INACTIVE: 403,
  ACCOUNT_LOCKED: 423,
  THROTTLED: 429,
  MFA_REQUIRED: 401,
  MFA_INVALID: 401,
  MFA_NOT_ENROLLED: 403,
};

const LoginRequestJsonSchema = schemaFromZod(LoginRequestSchema, "AuthLoginRequest");
const LoginResponseJsonSchema = schemaFromZod(LoginResponseSchema, "AuthLoginResponse");
const AuthContextResponseJsonSchema = schemaFromZod(
  AuthContextResponseSchema,
  "AuthContextResponse",
);
const ChangePasswordRequestJsonSchema = schemaFromZod(
  ChangePasswordRequestSchema,
  "AuthChangePasswordRequest",
);

const MfaCodeSchema = z.string().regex(/^\d{6}$/, "MFA code must be a 6-digit value");
const MfaEnrollResponseSchema = z.object({
  secret: z.string(),
  otpauth_url: z.string(),
  message: z.string(),
});
const MfaVerifyRequestSchema = z.object({
  mfa_code: MfaCodeSchema,
});
const MfaVerifyResponseSchema = z.object({
  message: z.string(),
});

const MfaEnrollResponseJsonSchema = schemaFromZod(MfaEnrollResponseSchema, "AuthMfaEnrollResponse");
const MfaVerifyRequestJsonSchema = schemaFromZod(MfaVerifyRequestSchema, "AuthMfaVerifyRequest");
const MfaVerifyResponseJsonSchema = schemaFromZod(MfaVerifyResponseSchema, "AuthMfaVerifyResponse");

type TenantMfaProfile = {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  mfa_secret: string | null;
  mfa_enabled: boolean;
};

const loadTenantMfaProfile = async (userId: string): Promise<TenantMfaProfile | null> => {
  const result = await pool.query<TenantMfaProfile>(TENANT_AUTH_MFA_PROFILE_SQL, [userId]);
  return result.rows[0] ?? null;
};

const buildOtpAuthUrl = (username: string, secret: string): string =>
  authenticator.keyuri(username, config.tenantAuth.security.mfa.issuer, secret);

export const registerAuthRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/auth/login",
    {
      schema: buildRouteSchema({
        tag: AUTH_TAG,
        summary: "Authenticate a user and return a JWT",
        body: LoginRequestJsonSchema,
        response: {
          200: LoginResponseJsonSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          423: errorResponseSchema,
          429: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { username, password, mfa_code } = LoginRequestSchema.parse(request.body);

      const result = await authenticateUser({ username, password, mfaCode: mfa_code });

      if (!result.ok) {
        const statusCode = AUTH_ERROR_STATUS[result.reason] ?? 401;
        if (result.reason === "THROTTLED" && result.retryAfterMs) {
          reply.header("Retry-After", Math.ceil(result.retryAfterMs / 1000).toString());
        }

        const errorCode = result.reason;
        const error = AUTH_ERROR_CODES[errorCode] ?? errorCode;
        const errorMessage = AUTH_ERROR_MESSAGES[errorCode] ?? error;

        return reply.status(statusCode).send({
          error,
          code: errorCode,
          message: errorMessage,
          lock_expires_at: result.lockExpiresAt?.toISOString(),
        });
      }

      const { user, memberships, accessToken, expiresIn } = result.data;

      const responsePayload = sanitizeForJson({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        is_active: user.is_active,
        memberships,
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        must_change_password: result.data.mustChangePassword,
      });

      return LoginResponseSchema.parse(responsePayload);
    },
  );

  app.get(
    "/v1/auth/context",
    {
      schema: buildRouteSchema({
        tag: AUTH_TAG,
        summary: "Return the authenticated user's memberships",
        response: {
          200: AuthContextResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const memberships = request.auth.memberships.map((membership) => ({
        tenant_id: membership.tenantId,
        tenant_name: membership.tenantName,
        role: membership.role,
        is_active: membership.isActive,
        permissions: membership.permissions ?? {},
      }));

      const responsePayload = sanitizeForJson({
        is_authenticated: request.auth.isAuthenticated,
        user_id: request.auth.userId,
        memberships,
        authorized_tenants: Array.from(request.auth.authorizedTenantIds),
        header_hint: {
          header: "Authorization",
          description:
            "Include the Authorization header with a Bearer token obtained from POST /v1/auth/login",
        },
      });

      return AuthContextResponseSchema.parse(responsePayload);
    },
  );

  app.post(
    "/v1/auth/change-password",
    {
      schema: buildRouteSchema({
        tag: AUTH_TAG,
        summary: "Change the authenticated user's password",
        body: ChangePasswordRequestJsonSchema,
        response: {
          200: LoginResponseJsonSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      if (!request.auth.isAuthenticated || !request.auth.userId) {
        reply.unauthorized("AUTHENTICATION_REQUIRED");
        return reply;
      }

      const { current_password, new_password } = ChangePasswordRequestSchema.parse(request.body);

      const result = await changeUserPassword(request.auth.userId, current_password, new_password);

      if (!result.ok) {
        if (result.reason === "ACCOUNT_INACTIVE") {
          return reply.status(403).send({
            error: "Account inactive",
            message: "This account is not active",
          });
        }

        const message =
          result.reason === "PASSWORD_REUSE_NOT_ALLOWED"
            ? "New password cannot be the system default password."
            : "Invalid credentials";

        return reply.status(400).send({
          error: "Invalid credentials",
          message,
        });
      }

      const { user, memberships, accessToken, expiresIn } = result.data;
      const payload = sanitizeForJson({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        is_active: user.is_active,
        memberships,
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        must_change_password: false,
      });

      return LoginResponseSchema.parse(payload);
    },
  );

  app.post(
    "/v1/auth/mfa/enroll",
    {
      schema: buildRouteSchema({
        tag: AUTH_TAG,
        summary: "Start MFA enrollment for the authenticated user",
        response: {
          200: MfaEnrollResponseJsonSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      if (!request.auth.isAuthenticated || !request.auth.userId) {
        reply.unauthorized("AUTHENTICATION_REQUIRED");
        return reply;
      }

      const profile = await loadTenantMfaProfile(request.auth.userId);
      if (!profile) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "User not found.",
        });
      }

      if (!profile.is_active) {
        return reply.status(403).send({
          error: "Account inactive",
          message: "This account is not active.",
        });
      }

      if (profile.mfa_enabled) {
        return reply.status(409).send({
          error: "MFA already enabled",
          message: "Multi-factor authentication is already enabled for this user.",
        });
      }

      const secret = authenticator.generateSecret();
      await pool.query(TENANT_AUTH_UPDATE_MFA_SQL, [secret, false, profile.id]);

      return MfaEnrollResponseSchema.parse({
        secret,
        otpauth_url: buildOtpAuthUrl(profile.username, secret),
        message: "MFA enrollment started. Verify the code to enable MFA.",
      });
    },
  );

  app.post(
    "/v1/auth/mfa/verify",
    {
      schema: buildRouteSchema({
        tag: AUTH_TAG,
        summary: "Verify MFA code and enable MFA",
        body: MfaVerifyRequestJsonSchema,
        response: {
          200: MfaVerifyResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      if (!request.auth.isAuthenticated || !request.auth.userId) {
        reply.unauthorized("AUTHENTICATION_REQUIRED");
        return reply;
      }

      const { mfa_code } = MfaVerifyRequestSchema.parse(request.body);
      const profile = await loadTenantMfaProfile(request.auth.userId);
      if (!profile) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "User not found.",
        });
      }

      if (!profile.is_active) {
        return reply.status(403).send({
          error: "Account inactive",
          message: "This account is not active.",
        });
      }

      if (profile.mfa_enabled) {
        return reply.status(409).send({
          error: "MFA already enabled",
          message: "Multi-factor authentication is already enabled for this user.",
        });
      }

      if (!profile.mfa_secret) {
        return reply.status(400).send({
          error: "MFA enrollment missing",
          message: "Start MFA enrollment before verifying the code.",
        });
      }

      const valid = authenticator.check(mfa_code, profile.mfa_secret);
      if (!valid) {
        return reply.status(400).send({
          error: "Invalid MFA code",
          message: "The provided MFA code is invalid.",
        });
      }

      await pool.query(TENANT_AUTH_UPDATE_MFA_SQL, [profile.mfa_secret, true, profile.id]);

      return MfaVerifyResponseSchema.parse({
        message: "MFA enabled successfully.",
      });
    },
  );

  app.post(
    "/v1/auth/mfa/rotate",
    {
      schema: buildRouteSchema({
        tag: AUTH_TAG,
        summary: "Rotate MFA secret for the authenticated user",
        body: MfaVerifyRequestJsonSchema,
        response: {
          200: MfaEnrollResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      if (!request.auth.isAuthenticated || !request.auth.userId) {
        reply.unauthorized("AUTHENTICATION_REQUIRED");
        return reply;
      }

      const { mfa_code } = MfaVerifyRequestSchema.parse(request.body);
      const profile = await loadTenantMfaProfile(request.auth.userId);
      if (!profile) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "User not found.",
        });
      }

      if (!profile.is_active) {
        return reply.status(403).send({
          error: "Account inactive",
          message: "This account is not active.",
        });
      }

      if (!profile.mfa_enabled) {
        return reply.status(409).send({
          error: "MFA not enabled",
          message: "Enable MFA before rotating the secret.",
        });
      }

      if (!profile.mfa_secret) {
        return reply.status(400).send({
          error: "MFA misconfigured",
          message: "MFA is enabled without a secret.",
        });
      }

      const valid = authenticator.check(mfa_code, profile.mfa_secret);
      if (!valid) {
        return reply.status(400).send({
          error: "Invalid MFA code",
          message: "The provided MFA code is invalid.",
        });
      }

      const secret = authenticator.generateSecret();
      await pool.query(TENANT_AUTH_UPDATE_MFA_SQL, [secret, false, profile.id]);

      return MfaEnrollResponseSchema.parse({
        secret,
        otpauth_url: buildOtpAuthUrl(profile.username, secret),
        message: "MFA rotation started. Verify the new code to re-enable MFA.",
      });
    },
  );
};
