import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { PublicSystemAdministratorSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  authenticateSystemAdministrator,
  authenticateSystemAdministratorWithBreakGlass,
} from "../services/system-admin-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const SystemAdminLoginRequestSchema = z.object({
  username: z.string().min(3),
  password: z.string(),
  mfa_code: z
    .string()
    .regex(/^\d{6}$/, "MFA code must be a 6-digit value")
    .optional(),
  device_fingerprint: z.string().min(8),
});

const SystemAdminProfileSchema = PublicSystemAdministratorSchema.pick({
  id: true,
  username: true,
  email: true,
  role: true,
  last_login_at: true,
  is_active: true,
});

const SystemAdminLoginResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().positive(),
  scope: z.literal("SYSTEM_ADMIN"),
  session_id: z.string(),
  admin: SystemAdminProfileSchema,
});

const SystemAdminBreakGlassLoginRequestSchema = z.object({
  username: z.string().min(3),
  break_glass_code: z.string().min(8),
  reason: z.string().min(10, "Reason must describe why emergency access is required."),
  ticket_id: z.string().min(3).optional(),
  device_fingerprint: z.string().min(8),
});

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
  SystemAdminBreakGlassLoginRequestSchema,
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
        mfaCode: body.mfa_code,
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
      const body = SystemAdminBreakGlassLoginRequestSchema.parse(request.body);
      const result = await authenticateSystemAdministratorWithBreakGlass({
        username: body.username,
        code: body.break_glass_code,
        reason: body.reason,
        ticketId: body.ticket_id,
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
