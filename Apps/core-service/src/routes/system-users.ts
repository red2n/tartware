import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  CreateUserRequestSchema,
  CreateUserResponseSchema,
  UserWithTenantsSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { query } from "../lib/db.js";
import { logSystemAdminEvent } from "../services/system-admin-service.js";
import { listUsers } from "../services/user-service.js";
import { hashPassword } from "../utils/password.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const SystemUserListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
  tenant_id: z.string().uuid().optional(),
});

const SystemUserListResponseSchema = z.object({
  users: z.array(
    UserWithTenantsSchema.extend({
      version: z.string(),
    }),
  ),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
const SystemUserListQueryJsonSchema = schemaFromZod(
  SystemUserListQuerySchema,
  "SystemUserListQuery",
);
const SystemUserListResponseJsonSchema = schemaFromZod(
  SystemUserListResponseSchema,
  "SystemUserListResponse",
);

const SYSTEM_USERS_TAG = "System Users";

const CreateUserJsonSchema = schemaFromZod(CreateUserRequestSchema, "CreateUser");
const CreateUserResponseJsonSchema = schemaFromZod(CreateUserResponseSchema, "CreateUserResponse");

export const registerSystemUserRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/system/users",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_ADMIN" }),
      schema: buildRouteSchema({
        tag: SYSTEM_USERS_TAG,
        summary: "Create a new user (system admin)",
        body: CreateUserJsonSchema,
        response: {
          201: CreateUserResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw request.server.httpErrors.unauthorized("System admin authentication required");
      }

      const data = CreateUserRequestSchema.parse(request.body);
      const passwordHash = await hashPassword(data.password);

      // PR feedback: Check for both username AND email conflicts before insert
      // to provide accurate error messages for either conflict type
      const [usernameResult, emailResult] = await Promise.all([
        query<{ username: string }>(`SELECT username FROM users WHERE username = $1 LIMIT 1`, [
          data.username,
        ]),
        query<{ email: string }>(`SELECT email FROM users WHERE email = $1 LIMIT 1`, [data.email]),
      ]);

      if (usernameResult.rows[0]) {
        throw request.server.httpErrors.conflict("Username already exists");
      }
      if (emailResult.rows[0]) {
        throw request.server.httpErrors.conflict("Email already exists");
      }

      // Use ON CONFLICT to handle race conditions atomically
      const { rows } = await query<{
        id: string;
        username: string;
        email: string;
        created: boolean;
      }>(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, is_active, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, true, false)
         ON CONFLICT DO NOTHING
         RETURNING id, username, email, true as created`,
        [
          data.username,
          data.email,
          passwordHash,
          data.first_name,
          data.last_name,
          data.phone || null,
        ],
      );

      const user = rows[0];
      if (!user) {
        // Race condition: another request created user between check and insert
        throw request.server.httpErrors.conflict(
          "User with this username or email was just created",
        );
      }

      // If tenant_id and role provided, create association
      if (data.tenant_id && data.role) {
        await query(
          `INSERT INTO user_tenant_associations (user_id, tenant_id, role, is_active)
           VALUES ($1, $2, $3, true)`,
          [user.id, data.tenant_id, data.role],
        );
      }

      await logSystemAdminEvent({
        adminId: adminContext.adminId,
        action: "USER_CREATE",
        resourceType: "USER",
        resourceId: user.id,
        requestMethod: "POST",
        requestPath: request.url,
        responseStatus: 201,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        sessionId: adminContext.sessionId,
      });

      reply.status(201);
      return CreateUserResponseSchema.parse({
        id: user.id,
        username: user.username,
        email: user.email,
        message: "User created successfully",
      });
    },
  );

  app.get(
    "/v1/system/users",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_OPERATOR" }),
      schema: buildRouteSchema({
        tag: SYSTEM_USERS_TAG,
        summary: "List users across tenants (system admin)",
        querystring: SystemUserListQueryJsonSchema,
        response: {
          200: SystemUserListResponseJsonSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw request.server.httpErrors.unauthorized(
          "System admin authentication middleware failed to populate context. Ensure the plugin is registered and the request includes a valid system admin token.",
        );
      }

      const { limit, offset, tenant_id } = SystemUserListQuerySchema.parse(request.query ?? {});
      const users = await listUsers({ limit, offset, tenantId: tenant_id });

      await logSystemAdminEvent({
        adminId: adminContext.adminId,
        action: "SYSTEM_USERS_LIST",
        resourceType: "USER",
        requestMethod: "GET",
        requestPath: request.url,
        responseStatus: 200,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        sessionId: adminContext.sessionId,
      });

      return SystemUserListResponseSchema.parse(
        sanitizeForJson({ users, count: users.length, limit, offset }),
      );
    },
  );
};
