import { PropertyWithStatsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listProperties } from "../services/property-service.js";

const PropertyListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid(),
});

type PropertyListQuery = z.infer<typeof PropertyListQuerySchema>;

// Response schema with version as string (BigInt serialized for JSON)
const PropertyListResponseSchema = z.array(
  PropertyWithStatsSchema.omit({ version: true }).extend({
    version: z.string(),
  }),
);

export const registerPropertyRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: PropertyListQuery }>(
    "/v1/properties",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PropertyListQuery).tenant_id,
        minRole: "STAFF",
      }),
    },
    async (request) => {
      const { limit, tenant_id } = PropertyListQuerySchema.parse(request.query);
      const properties = await listProperties({ limit, tenantId: tenant_id });
      // Properties already have version as string from the service
      return PropertyListResponseSchema.parse(properties);
    },
  );
};
