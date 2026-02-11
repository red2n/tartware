import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  SystemAdminBreakGlassRequestSchema,
  SystemAdminLoginRequestSchema,
  SystemAdminLoginResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import {
  authenticateSystemAdministrator,
  authenticateSystemAdministratorWithBreakGlass,
} from "../services/system-admin-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid username, password, or MFA code.",
  ACCOUNT_INACTIVE: "This system administrator account is inactive.",
  ACCOUNT_LOCKED: "Account temporarily locked due to multiple failed attempts.",
  IP_NOT_ALLOWED: "Login from this IP address is not permitted.",
  OUTSIDE_ALLOWED_HOURS: "Login attempted outside approved access hours.",
  DEVICE_NOT_TRUSTED: "Device not approved for this administrator.",
  MFA_REQUIRED: "Multi-factor authentication code required.",
  MFA_INVALID: "Invalid multi-factor authentication code.",
  ADMIN_NOT_FOUND: "System administrator not found or inactive.",
  BREAK_GLASS_UNAVAILABLE: "No emergency access codes are available for this administrator.",
  BREAK_GLASS_CODE_INVALID: "The provided break-glass code is invalid or already used.",
};

const ERROR_STATUS: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  ACCOUNT_INACTIVE: 403,
  ACCOUNT_LOCKED: 423,
  IP_NOT_ALLOWED: 403,
  OUTSIDE_ALLOWED_HOURS: 403,
  DEVICE_NOT_TRUSTED: 403,
  MFA_REQUIRED: 401,
  MFA_INVALID: 401,
  ADMIN_NOT_FOUND: 401,
  BREAK_GLASS_UNAVAILABLE: 403,
  BREAK_GLASS_CODE_INVALID: 401,
};

const SYSTEM_AUTH_TAG = "System Auth";
const SystemAdminLoginRequestJsonSchema = schemaFromZod(
  SystemAdminLoginRequestSchema,
  "SystemAdminLoginRequest",
);
const SystemAdminLoginResponseJsonSchema = schemaFromZod(
  SystemAdminLoginResponseSchema,
  "SystemAdminLoginResponse",
);
const SystemAdminBreakGlassLoginRequestJsonSchema = schemaFromZod(
  SystemAdminBreakGlassRequestSchema,
  "SystemAdminBreakGlassLoginRequest",
);

export const registerSystemAuthRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/system/auth/login",
    {
      schema: buildRouteSchema({
        tag: SYSTEM_AUTH_TAG,
        summary: "Authenticate a platform system administrator",
        body: SystemAdminLoginRequestJsonSchema,
        response: {
          200: SystemAdminLoginResponseJsonSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          423: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = SystemAdminLoginRequestSchema.parse(request.body);
      const result = await authenticateSystemAdministrator({
        username: body.username,
        password: body.password,
        mfaCode: body.mfa_code ?? undefined,
        deviceFingerprint: body.device_fingerprint,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      if (!result.ok) {
        const statusCode = ERROR_STATUS[result.reason] ?? 401;
        const payload = {
          error: result.reason,
          message: ERROR_MESSAGES[result.reason] ?? "Unable to complete login request.",
          lock_expires_at: result.lockExpiresAt?.toISOString(),
        };
        return reply.status(statusCode).send(payload);
      }

      const responsePayload = sanitizeForJson({
        access_token: result.data.token,
        token_type: "Bearer",
        expires_in: result.data.expiresIn,
        scope: "SYSTEM_ADMIN" as const,
        session_id: result.data.sessionId,
        admin: result.data.admin,
      });

      return SystemAdminLoginResponseSchema.parse(responsePayload);
    },
  );

  app.post(
    "/v1/system/auth/break-glass",
    {
      schema: buildRouteSchema({
        tag: SYSTEM_AUTH_TAG,
        summary: "Emergency break-glass login for system administrators",
        body: SystemAdminBreakGlassLoginRequestJsonSchema,
        response: {
          200: SystemAdminLoginResponseJsonSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = SystemAdminBreakGlassRequestSchema.parse(request.body);
      const result = await authenticateSystemAdministratorWithBreakGlass({
        username: body.username,
        code: body.break_glass_code,
        reason: body.reason,
        ticketId: body.ticket_id ?? undefined,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        deviceFingerprint: body.device_fingerprint,
      });

      if (!result.ok) {
        const statusCode = ERROR_STATUS[result.reason] ?? 401;
        return reply.status(statusCode).send({
          error: result.reason,
          message: ERROR_MESSAGES[result.reason] ?? "Unable to complete break-glass request.",
        });
      }

      const responsePayload = sanitizeForJson({
        access_token: result.data.token,
        token_type: "Bearer",
        expires_in: result.data.expiresIn,
        scope: "SYSTEM_ADMIN" as const,
        session_id: result.data.sessionId,
        admin: result.data.admin,
      });

      return SystemAdminLoginResponseSchema.parse(responsePayload);
    },
  );
};
