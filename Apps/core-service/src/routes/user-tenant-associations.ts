import { TenantRoleEnum, UserTenantAssociationWithDetailsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listUserTenantAssociations } from "../services/user-tenant-association-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const AssociationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  role: TenantRoleEnum.optional(),
  is_active: z.coerce.boolean().optional(),
});

type AssociationListQuery = z.infer<typeof AssociationListQuerySchema>;

const AssociationListResponseSchema = z.array(
  UserTenantAssociationWithDetailsSchema.extend({
    version: z.string(),
  }),
);

export const registerUserTenantAssociationRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: AssociationListQuery }>(
    "/v1/user-tenant-associations",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as AssociationListQuery).tenant_id,
        minRole: "ADMIN",
      }),
    },
    async (request) => {
      const { limit, tenant_id, user_id, role, is_active } = AssociationListQuerySchema.parse(
        request.query,
      );

      const associations = await listUserTenantAssociations({
        limit,
        tenantId: tenant_id,
        userId: user_id,
        role,
        isActive: is_active,
      });

      const response = sanitizeForJson(associations);
      return AssociationListResponseSchema.parse(response);
    },
  );
};
