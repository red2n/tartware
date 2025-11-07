import { TenantRoleEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AUTH_USER_ID_HEADER } from "../plugins/auth-context.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const AuthMembershipSchema = z.object({
  tenant_id: z.string().uuid(),
  role: TenantRoleEnum,
  is_active: z.boolean(),
  permissions: z.record(z.unknown()),
});

const AuthContextResponseSchema = z.object({
  is_authenticated: z.boolean(),
  user_id: z.string().uuid().nullable(),
  memberships: z.array(AuthMembershipSchema),
  authorized_tenants: z.array(z.string().uuid()),
  header_hint: z.object({
    header: z.literal(AUTH_USER_ID_HEADER),
    description: z.string(),
  }),
});

export const registerAuthRoutes = (app: FastifyInstance): void => {
  app.get("/v1/auth/context", async (request) => {
    const memberships = request.auth.memberships.map((membership) => ({
      tenant_id: membership.tenantId,
      role: membership.role,
      is_active: membership.isActive,
      permissions: membership.permissions ?? {},
    }));

    const responsePayload = sanitizeForJson({
      is_authenticated: request.auth.isAuthenticated,
      user_id: request.auth.userId,
      memberships,
      authorized_tenants: Array.from(request.auth.authorizedTenantIds),
      header_hint: {
        header: AUTH_USER_ID_HEADER,
        description: `Include the ${AUTH_USER_ID_HEADER} header with a valid user UUID to authenticate requests`,
      },
    });

    return AuthContextResponseSchema.parse(responsePayload);
  });
};
