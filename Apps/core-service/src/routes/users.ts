import { UserWithTenantsSchema } from "@tartware/schemas/core/users";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { listUsers } from "../services/user-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const UserListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid().optional(),
});

type UserListQuery = z.infer<typeof UserListQuerySchema>;

const UserListResponseSchema = z.array(
  UserWithTenantsSchema.extend({
    version: z.string(),
  }),
);

export const registerUserRoutes = (app: FastifyInstance): void => {
  app.get("/v1/users", async (request: FastifyRequest<{ Querystring: UserListQuery }>) => {
    const { limit, tenant_id } = UserListQuerySchema.parse(request.query);
    const users = await listUsers({ limit, tenantId: tenant_id });
    const response = sanitizeForJson(users);
    return UserListResponseSchema.parse(response);
  });
};
