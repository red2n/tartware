import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getEnterpriseInsights } from "../services/enterprise-insights-service.js";

const EnterpriseInsightsQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
});

type EnterpriseInsightsQuery = z.infer<typeof EnterpriseInsightsQuerySchema>;

export const registerEnterpriseInsightsRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: EnterpriseInsightsQuery }>(
    "/v1/enterprise/insights",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as EnterpriseInsightsQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "enterprise-api",
      }),
    },
    async (request) => {
      const query = EnterpriseInsightsQuerySchema.parse(request.query);
      const insights = await getEnterpriseInsights({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
      });
      return insights;
    },
  );
};
