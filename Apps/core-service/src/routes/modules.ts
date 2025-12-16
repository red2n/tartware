import type { FastifyInstance } from "fastify";

import { buildRouteSchema, jsonArraySchema, jsonObjectSchema } from "../lib/openapi.js";
import { getModuleCatalog, getTenantModules } from "../services/tenant-module-service.js";

const MODULES_TAG = "Modules";

export const registerModuleRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/modules/catalog",
    {
      preHandler: async (request, reply) => {
        if (!request.auth.isAuthenticated) {
          reply.unauthorized("AUTHENTICATION_REQUIRED");
          return reply;
        }
      },
      schema: buildRouteSchema({
        tag: MODULES_TAG,
        summary: "List available platform modules",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    async () => getModuleCatalog(),
  );

  app.get<{ Params: { tenantId: string } }>(
    "/v1/tenants/:tenantId/modules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as { tenantId: string }).tenantId,
        minRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: MODULES_TAG,
        summary: "List modules enabled for a tenant",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string", format: "uuid" },
          },
          required: ["tenantId"],
        },
        response: {
          200: jsonArraySchema,
        },
      }),
    },
    async (request) => {
      const { tenantId } = request.params as { tenantId: string };
      const modules = await getTenantModules(tenantId);
      return modules;
    },
  );
};
