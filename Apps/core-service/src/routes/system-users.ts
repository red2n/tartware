import { UserWithTenantsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "../lib/openapi.js";
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
const SystemUserListQueryJsonSchema = schemaFromZod(
  SystemUserListQuerySchema,
  "SystemUserListQuery",
);
const SystemUserListResponseJsonSchema = schemaFromZod(
  SystemUserListResponseSchema,
  "SystemUserListResponse",
);

const SYSTEM_USERS_TAG = "System Users";

export const registerSystemUserRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/system/users",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_OPERATOR" }),
      schema: buildRouteSchema({
        tag: SYSTEM_USERS_TAG,
        summary: "List users across tenants (system admin)",
        querystring: SystemUserListQueryJsonSchema,
        response: {
          200: SystemUserListResponseJsonSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw request.server.httpErrors.unauthorized(
          "System admin authentication middleware failed to populate context. Ensure the plugin is registered and the request includes a valid system admin token.",
        );
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
