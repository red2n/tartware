import { PublicUserSchema, TenantRoleEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticateUser } from "../services/auth-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

// Use schemas from @tartware/schemas
const AuthMembershipSchema = z.object({
  tenant_id: z.string().uuid(),
  tenant_name: z.string().min(1).optional(),
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
    header: z.literal("Authorization"),
    description: z.string(),
  }),
});

// Login request schema
const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password is required"),
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
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().positive(),
});

export const registerAuthRoutes = (app: FastifyInstance): void => {
  app.post("/v1/auth/login", async (request, reply) => {
    const { username, password } = LoginRequestSchema.parse(request.body);

    const result = await authenticateUser(username, password);

    if (!result.ok) {
      if (result.reason === "ACCOUNT_INACTIVE") {
        return reply.status(403).send({
          error: "Account inactive",
          message: "This account is not active",
        });
      }

      return reply.status(401).send({
        error: "Invalid credentials",
        message: "Invalid username or password",
      });
    }

    const { user, memberships, accessToken, expiresIn } = result.data;

    const responsePayload = sanitizeForJson({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      is_active: user.is_active,
      memberships,
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
    });

    return LoginResponseSchema.parse(responsePayload);
  });

  app.get("/v1/auth/context", async (request) => {
    const memberships = request.auth.memberships.map((membership) => ({
      tenant_id: membership.tenantId,
      tenant_name: membership.tenantName,
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
        header: "Authorization",
        description:
          "Include the Authorization header with a Bearer token obtained from POST /v1/auth/login",
      },
    });

    return AuthContextResponseSchema.parse(responsePayload);
  });
};
