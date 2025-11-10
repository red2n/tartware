import { PublicUserSchema, TenantRoleEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AUTH_USER_ID_HEADER } from "../plugins/auth-context.js";
import { userCacheService } from "../services/user-cache-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

// Use schemas from @tartware/schemas
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

// Login request - simplified for dev (username only)
const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

// Login response using PublicUserSchema from @tartware/schemas
const LoginResponseSchema = PublicUserSchema.pick({
  id: true,
  username: true,
  email: true,
  first_name: true,
  last_name: true,
  is_active: true,
}).extend({
  memberships: z.array(AuthMembershipSchema),
});

export const registerAuthRoutes = (app: FastifyInstance): void => {
  app.post("/v1/auth/login", async (request, reply) => {
    const { username } = LoginRequestSchema.parse(request.body);

    // Use cache service with Bloom filter and cache layers
    const userWithMemberships = await userCacheService.getUserWithMemberships(username);

    if (!userWithMemberships) {
      return reply.status(404).send({
        error: "User not found",
        message: `No user found with username: ${username}`,
      });
    }

    if (!userWithMemberships.is_active) {
      return reply.status(403).send({
        error: "Account inactive",
        message: "This account is not active",
      });
    }

    const responsePayload = sanitizeForJson({
      id: userWithMemberships.id,
      email: userWithMemberships.email,
      first_name: userWithMemberships.first_name,
      last_name: userWithMemberships.last_name,
      username: userWithMemberships.username,
      is_active: userWithMemberships.is_active,
      memberships: userWithMemberships.memberships,
    });

    return LoginResponseSchema.parse(responsePayload);
  });

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
