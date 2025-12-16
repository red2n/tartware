import { TenantWithRelationsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "../lib/openapi.js";
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
const SystemTenantListQueryJsonSchema = schemaFromZod(
  SystemTenantListQuerySchema,
  "SystemTenantListQuery",
);
const SystemTenantListResponseJsonSchema = schemaFromZod(
  SystemTenantListResponseSchema,
  "SystemTenantListResponse",
);

const SYSTEM_TENANTS_TAG = "System Tenants";

export const registerSystemTenantRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/system/tenants",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_OPERATOR" }),
      schema: buildRouteSchema({
        tag: SYSTEM_TENANTS_TAG,
        summary: "List tenants for system administrators",
        querystring: SystemTenantListQueryJsonSchema,
        response: {
          200: SystemTenantListResponseJsonSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw request.server.httpErrors.unauthorized(
          "System admin authentication middleware failed to populate context. Ensure the system admin plugin is registered and the request carries a valid token.",
        );
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
