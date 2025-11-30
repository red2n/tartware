import { UserTenantMembershipSchema, UserWithTenantsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listUsers } from "../services/user-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const UserListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid(),
});

type UserListQuery = z.infer<typeof UserListQuerySchema>;

const UserListResponseSchema = z.array(
  UserWithTenantsSchema.omit({ version: true, tenants: true }).extend({
    version: z.string(), // BigInt serialized as string
    tenants: z.array(UserTenantMembershipSchema).default([]),
  }),
);

export const registerUserRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: UserListQuery }>(
    "/v1/users",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as UserListQuery).tenant_id,
        minRole: "MANAGER",
      }),
    },
    async (request) => {
      const { limit, tenant_id } = UserListQuerySchema.parse(request.query);
      const users = await listUsers({ limit, tenantId: tenant_id });
      const response = (sanitizeForJson(users) as Array<Record<string, unknown>>).map((user) => ({
        ...user,
        version: String(user.version ?? "0"),
        tenants: Array.isArray(user.tenants) ? user.tenants : [],
      }));
      return UserListResponseSchema.parse(response);
    },
  );
};
