import { TenantWithRelationsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { logSystemAdminEvent } from "../services/system-admin-service.js";
import { listTenants } from "../services/tenant-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const SystemTenantListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const SystemTenantListResponseSchema = z.object({
  tenants: z.array(
    TenantWithRelationsSchema.extend({
      version: z.string(),
    }),
  ),
  count: z.number().int().nonnegative(),
});

export const registerSystemTenantRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/system/tenants",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_OPERATOR" }),
    },
    async (request) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw new Error("System admin context is not available");
      }

      const { limit } = SystemTenantListQuerySchema.parse(request.query ?? {});
      const tenants = await listTenants({ limit });
      const sanitized = sanitizeForJson({
        tenants,
        count: tenants.length,
      });

      await logSystemAdminEvent({
        adminId: adminContext.adminId,
        action: "SYSTEM_TENANTS_LIST",
        resourceType: "TENANT",
        requestMethod: "GET",
        requestPath: request.url,
        responseStatus: 200,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        sessionId: adminContext.sessionId,
      });

      return SystemTenantListResponseSchema.parse(sanitized);
    },
  );
};
