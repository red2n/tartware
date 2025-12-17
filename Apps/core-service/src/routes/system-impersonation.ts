import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { startImpersonationSession } from "../services/system-admin-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const SystemImpersonationRequestSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  reason: z.string().min(10),
  ticket_id: z.string().min(5),
});

const SystemImpersonationResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  scope: z.literal("TENANT_IMPERSONATION"),
  expires_in: z.number().positive(),
});

const IMPERSONATION_ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: "User was not found or is inactive.",
  TENANT_ACCESS_DENIED: "User is not associated with the requested tenant.",
  MEMBERSHIP_INACTIVE: "User membership for this tenant is inactive.",
};

const SYSTEM_IMPERSONATION_TAG = "System Impersonation";
const SystemImpersonationRequestJsonSchema = schemaFromZod(
  SystemImpersonationRequestSchema,
  "SystemImpersonationRequest",
);
const SystemImpersonationResponseJsonSchema = schemaFromZod(
  SystemImpersonationResponseSchema,
  "SystemImpersonationResponse",
);

export const registerSystemImpersonationRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/system/impersonate",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_SUPPORT" }),
      schema: buildRouteSchema({
        tag: SYSTEM_IMPERSONATION_TAG,
        summary: "Start a tenant impersonation session",
        body: SystemImpersonationRequestJsonSchema,
        response: {
          200: SystemImpersonationResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        return reply.status(401).send({
          error: "SYSTEM_ADMIN_CONTEXT_MISSING",
          message:
            "System admin authentication middleware failed to populate context. Ensure the plugin is registered and a valid system admin token is supplied.",
        });
      }

      const body = SystemImpersonationRequestSchema.parse(request.body);
      const result = await startImpersonationSession(
        {
          adminId: adminContext.adminId,
          sessionId: adminContext.sessionId,
        },
        {
          tenantId: body.tenant_id,
          userId: body.user_id,
          reason: body.reason,
          ticketId: body.ticket_id,
        },
      );

      if (!result.ok) {
        const message =
          IMPERSONATION_ERROR_MESSAGES[result.reason] ?? "Unable to start impersonation session.";
        return reply.status(400).send({
          error: result.reason,
          message,
        });
      }

      const payload = sanitizeForJson({
        access_token: result.data.accessToken,
        token_type: "Bearer" as const,
        scope: "TENANT_IMPERSONATION" as const,
        expires_in: result.data.expiresIn,
      });

      return SystemImpersonationResponseSchema.parse(payload);
    },
  );
};
