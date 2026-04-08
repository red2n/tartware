import { buildRouteSchema, jsonArraySchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";

import {
  getModuleCatalog,
  getTenantModules,
  updateTenantModules,
} from "../services/tenant-module-service.js";

const MODULES_TAG = "Modules";

export const registerModuleRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/modules/catalog",
    {
      preHandler: async (request, reply) => {
        if (!request.auth.isAuthenticated) {
          reply.unauthorized("You must be logged in to access this resource.");
          return reply;
        }
      },
      schema: buildRouteSchema({
        tag: MODULES_TAG,
        summary: "List available platform modules",
        response: {
          200: jsonArraySchema,
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
          200: jsonObjectSchema,
        },
      }),
    },
    async (request) => {
      const { tenantId } = request.params as { tenantId: string };
      const modules = await getTenantModules(tenantId);
      return modules;
    },
  );

  app.put<{ Params: { tenantId: string }; Body: { modules: string[] } }>(
    "/v1/tenants/:tenantId/modules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as { tenantId: string }).tenantId,
        minRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: MODULES_TAG,
        summary: "Enable modules for a tenant",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string", format: "uuid" },
          },
          required: ["tenantId"],
        },
        body: {
          type: "object",
          properties: {
            modules: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["modules"],
        },
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    async (request) => {
      const { tenantId } = request.params;
      const { modules } = request.body;
      return updateTenantModules(tenantId, modules);
    },
  );
};
