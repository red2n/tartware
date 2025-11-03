import { PropertyWithStatsSchema } from "@tartware/schemas/core/properties";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { listProperties } from "../services/property-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const PropertyListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid().optional(),
});

type PropertyListQuery = z.infer<typeof PropertyListQuerySchema>;

const PropertyListResponseSchema = z.array(
  PropertyWithStatsSchema.extend({
    version: z.string(),
  }),
);

export const registerPropertyRoutes = (app: FastifyInstance): void => {
  app.get("/v1/properties", async (request: FastifyRequest<{ Querystring: PropertyListQuery }>) => {
    const { limit, tenant_id } = PropertyListQuerySchema.parse(request.query);
    const properties = await listProperties({ limit, tenantId: tenant_id });
    const response = sanitizeForJson(properties);
    return PropertyListResponseSchema.parse(response);
  });
};
