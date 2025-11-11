import type { FastifyInstance } from "fastify";

import { getModuleCatalog, getTenantModules } from "../services/tenant-module-service.js";

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
    },
    async () => getModuleCatalog(),
  );

  app.get<{ Params: { tenantId: string } }>(
    "/v1/tenants/:tenantId/modules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as { tenantId: string }).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request) => {
      const { tenantId } = request.params as { tenantId: string };
      const modules = await getTenantModules(tenantId);
      return modules;
    },
  );
};
