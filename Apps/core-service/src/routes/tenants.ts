import { TenantWithRelationsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listTenants } from "../services/tenant-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const TenantListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const TenantListResponseSchema = z.array(
  TenantWithRelationsSchema.extend({
    version: z.string(),
  }),
);

type TenantListQuery = z.infer<typeof TenantListQuerySchema>;

export const registerTenantRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: TenantListQuery }>(
    "/v1/tenants",
    {
      preHandler: app.withTenantScope({
        allowMissingTenantId: true,
        requireAnyTenantWithRole: "ADMIN",
      }),
    },
    async (request) => {
      const { limit } = TenantListQuerySchema.parse(request.query);
      const tenants = await listTenants({ limit });
      const response = sanitizeForJson(tenants);
      return TenantListResponseSchema.parse(response);
    },
  );
};
