import { TenantWithRelationsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listTenants } from "../services/tenant-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const TenantListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

type TenantListQuery = z.infer<typeof TenantListQuerySchema>;

const TenantListResponseSchema = z.array(
  TenantWithRelationsSchema.extend({
    version: z.string(), // BigInt serialized as string
  }),
);

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
      // Only return tenants the user has access to
      const tenantIds = Array.from(request.auth.membershipMap.keys());
      const tenants = await listTenants({ limit, tenantIds });
      const response = sanitizeForJson(tenants);
      return TenantListResponseSchema.parse(response);
    },
  );
};
