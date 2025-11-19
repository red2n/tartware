import { UserWithTenantsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { logSystemAdminEvent } from "../services/system-admin-service.js";
import { listUsers } from "../services/user-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const SystemUserListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  tenant_id: z.string().uuid().optional(),
});

const SystemUserListResponseSchema = z.array(
  UserWithTenantsSchema.extend({
    version: z.string(),
  }),
);

export const registerSystemUserRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/system/users",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_OPERATOR" }),
    },
    async (request) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw new Error("System admin context is not available");
      }

      const { limit, tenant_id } = SystemUserListQuerySchema.parse(request.query ?? {});
      const users = await listUsers({ limit, tenantId: tenant_id });

      await logSystemAdminEvent({
        adminId: adminContext.adminId,
        action: "SYSTEM_USERS_LIST",
        resourceType: "USER",
        requestMethod: "GET",
        requestPath: request.url,
        responseStatus: 200,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        sessionId: adminContext.sessionId,
      });

      return SystemUserListResponseSchema.parse(sanitizeForJson(users));
    },
  );
};
