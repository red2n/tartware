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

export const registerSystemImpersonationRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/system/impersonate",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_SUPPORT" }),
    },
    async (request, reply) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw new Error("System admin context is not available");
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
