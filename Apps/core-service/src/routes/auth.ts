import { TenantRoleEnum, PublicUserSchema, UserTenantAssociationSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AUTH_USER_ID_HEADER } from "../plugins/auth-context.js";
import { sanitizeForJson } from "../utils/sanitize.js";
import { pool } from "../lib/db.js";

// Use the schema from @tartware/schemas for tenant associations
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

// Login request accepts username (from @tartware/schemas UserLoginSchema inspiration)
const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

// Login response using PublicUserSchema fields
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

    // Look up user by username
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name, username, is_active
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return reply.status(404).send({
        error: "User not found",
        message: `No user found with username: ${username}`,
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return reply.status(403).send({
        error: "Account inactive",
        message: "This account is not active",
      });
    }

    // Get user's tenant memberships
    const membershipsResult = await pool.query(
      `SELECT uta.tenant_id, uta.role, uta.is_active, uta.permissions
       FROM user_tenant_associations uta
       WHERE uta.user_id = $1 AND uta.deleted_at IS NULL`,
      [user.id]
    );

    const memberships = membershipsResult.rows.map((row) => ({
      tenant_id: row.tenant_id,
      role: row.role,
      is_active: row.is_active,
      permissions: row.permissions ?? {},
    }));

    const responsePayload = sanitizeForJson({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      is_active: user.is_active,
      memberships,
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
