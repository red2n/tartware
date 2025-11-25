import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getPortalExperienceSummary } from "../services/portal-experience-service.js";

const PortalExperienceQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
});

type PortalExperienceQuery = z.infer<typeof PortalExperienceQuerySchema>;

export const registerPortalExperienceRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: PortalExperienceQuery }>(
    "/v1/portal/experience",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PortalExperienceQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "tenant-owner-portal",
      }),
    },
    async (request) => {
      const query = PortalExperienceQuerySchema.parse(request.query);
      const summary = await getPortalExperienceSummary({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
      });
      return summary;
    },
  );
};
