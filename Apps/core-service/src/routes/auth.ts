import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  AuthContextResponseSchema,
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  MfaEnrollResponseSchema,
  MfaVerifyRequestSchema,
  MfaVerifyResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { authenticator } from "otplib";

import { config } from "../config.js";
import { pool } from "../lib/db.js";
import { authenticateUser, changeUserPassword } from "../services/auth-service.js";
import {
  TENANT_AUTH_MFA_PROFILE_SQL,
  TENANT_AUTH_UPDATE_MFA_SQL,
} from "../sql/tenant-auth-queries.js";
import { sanitizeForJson } from "../utils/sanitize.js";

// App-specific refinement: prevent default password
const AppChangePasswordRequestSchema = ChangePasswordRequestSchema.refine(
  (data) => data.new_password !== config.auth.defaultPassword,
  { message: "New password cannot be the default password." },
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
  AppChangePasswordRequestSchema,
  "AuthChangePasswordRequest",
);

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
        reply.unauthorized("You must be logged in to access this resource.");
        return reply;
      }

      const { current_password, new_password } = ChangePasswordRequestSchema.parse(request.body);

      const result = await changeUserPassword(request.auth.userId, current_password, new_password);

      if (!result.ok) {
        if (result.reason === "ACCOUNT_INACTIVE") {
          return reply.forbidden("This account is not active");
        }

        const message =
          result.reason === "PASSWORD_REUSE_NOT_ALLOWED"
            ? "New password cannot be the system default password."
            : "Invalid credentials";

        return reply.badRequest(message);
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
        reply.unauthorized("You must be logged in to access this resource.");
        return reply;
      }

      const profile = await loadTenantMfaProfile(request.auth.userId);
      if (!profile) {
        return reply.unauthorized("User not found.");
      }

      if (!profile.is_active) {
        return reply.forbidden("This account is not active.");
      }

      if (profile.mfa_enabled) {
        return reply.conflict("Multi-factor authentication is already enabled for this user.");
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
        reply.unauthorized("You must be logged in to access this resource.");
        return reply;
      }

      const { mfa_code } = MfaVerifyRequestSchema.parse(request.body);
      const profile = await loadTenantMfaProfile(request.auth.userId);
      if (!profile) {
        return reply.unauthorized("User not found.");
      }

      if (!profile.is_active) {
        return reply.forbidden("This account is not active.");
      }

      if (profile.mfa_enabled) {
        return reply.conflict("Multi-factor authentication is already enabled for this user.");
      }

      if (!profile.mfa_secret) {
        return reply.badRequest("Start MFA enrollment before verifying the code.");
      }

      const valid = authenticator.check(mfa_code, profile.mfa_secret);
      if (!valid) {
        return reply.badRequest("The provided MFA code is invalid.");
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
        reply.unauthorized("You must be logged in to access this resource.");
        return reply;
      }

      const { mfa_code } = MfaVerifyRequestSchema.parse(request.body);
      const profile = await loadTenantMfaProfile(request.auth.userId);
      if (!profile) {
        return reply.unauthorized("User not found.");
      }

      if (!profile.is_active) {
        return reply.forbidden("This account is not active.");
      }

      if (!profile.mfa_enabled) {
        return reply.conflict("Enable MFA before rotating the secret.");
      }

      if (!profile.mfa_secret) {
        return reply.badRequest("MFA is enabled without a secret.");
      }

      const valid = authenticator.check(mfa_code, profile.mfa_secret);
      if (!valid) {
        return reply.badRequest("The provided MFA code is invalid.");
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
