import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { PublicUserSchema, TenantRoleEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { config } from "../config.js";
import { pool, query } from "../lib/db.js";
import { emitMembershipCacheInvalidation } from "../services/membership-cache-hooks.js";
import { resetTenantLoginState } from "../services/tenant-auth-security-service.js";
import { listUsers } from "../services/user-service.js";
import { TENANT_AUTH_UPDATE_PASSWORD_SQL } from "../sql/tenant-auth-queries.js";
import { hashPassword } from "../utils/password.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const UserListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  tenant_id: z.string().uuid(),
});

type UserListQuery = z.infer<typeof UserListQuerySchema>;

const UserListResponseSchema = z.array(
  PublicUserSchema.extend({
    version: z.string(), // BigInt serialized as string
  }),
);
const UserListQueryJsonSchema = schemaFromZod(UserListQuerySchema, "UserListQuery");
const UserListResponseJsonSchema = schemaFromZod(UserListResponseSchema, "UserListResponse");

const CreateTenantUserSchema = z.object({
  tenant_id: z.string().uuid(),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: z.string().optional(),
  role: TenantRoleEnum,
});

const CreateTenantUserResponseSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  message: z.string(),
});

const CreateTenantUserJsonSchema = schemaFromZod(CreateTenantUserSchema, "CreateTenantUser");
const CreateTenantUserResponseJsonSchema = schemaFromZod(
  CreateTenantUserResponseSchema,
  "CreateTenantUserResponse",
);

const ResetTenantUserPasswordSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  new_password: z.string().min(8).optional(),
});

const ResetTenantUserPasswordResponseSchema = z.object({
  user_id: z.string().uuid(),
  message: z.string(),
});

const ResetTenantUserPasswordJsonSchema = schemaFromZod(
  ResetTenantUserPasswordSchema,
  "ResetTenantUserPassword",
);
const ResetTenantUserPasswordResponseJsonSchema = schemaFromZod(
  ResetTenantUserPasswordResponseSchema,
  "ResetTenantUserPasswordResponse",
);

const USERS_TAG = "Users";

export const registerUserRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: UserListQuery }>(
    "/v1/users",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as UserListQuery).tenant_id,
        minRole: "MANAGER",
      }),
      schema: buildRouteSchema({
        tag: USERS_TAG,
        summary: "List tenant users",
        querystring: UserListQueryJsonSchema,
        response: {
          200: UserListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { limit, offset, tenant_id } = UserListQuerySchema.parse(request.query);
      const users = await listUsers({ limit, offset, tenantId: tenant_id });
      const response = sanitizeForJson(users);
      return UserListResponseSchema.parse(response);
    },
  );

  app.post(
    "/v1/users",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof CreateTenantUserSchema>).tenant_id,
        minRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: USERS_TAG,
        summary: "Create or invite a tenant user",
        body: CreateTenantUserJsonSchema,
        response: {
          201: CreateTenantUserResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const authUserId = request.auth.userId;
      if (!authUserId) {
        throw request.server.httpErrors.unauthorized("AUTHENTICATION_REQUIRED");
      }

      const data = CreateTenantUserSchema.parse(request.body);
      const passwordToSet = data.password ?? config.auth.defaultPassword;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const existingUserResult = await client.query<{
          id: string;
          username: string;
          email: string;
        }>(
          `SELECT id, username, email
           FROM public.users
           WHERE (username = $1 OR email = $2)
             AND deleted_at IS NULL
             AND COALESCE(is_deleted, false) = false
           LIMIT 1`,
          [data.username, data.email],
        );

        const existingUser = existingUserResult.rows[0];
        let userId = existingUser?.id ?? null;

        if (existingUser) {
          if (existingUser.username !== data.username || existingUser.email !== data.email) {
            throw request.server.httpErrors.conflict("USER_ALREADY_EXISTS");
          }
        } else {
          const passwordHash = await hashPassword(passwordToSet);
          const userInsert = await client.query<{ id: string; username: string; email: string }>(
            `INSERT INTO users
              (username, email, password_hash, first_name, last_name, phone, is_active, is_verified, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $7)
             RETURNING id, username, email`,
            [
              data.username,
              data.email,
              passwordHash,
              data.first_name,
              data.last_name,
              data.phone || null,
              authUserId,
            ],
          );

          const insertedUser = userInsert.rows[0];
          if (!insertedUser) {
            throw new Error("Failed to create user");
          }

          userId = insertedUser.id;
        }

        if (!userId) {
          throw new Error("User creation failed to produce an id");
        }

        const associationResult = await client.query<{
          id: string;
          is_deleted: boolean | null;
          deleted_at: Date | null;
        }>(
          `SELECT id, is_deleted, deleted_at
           FROM public.user_tenant_associations
           WHERE user_id = $1
             AND tenant_id = $2
           LIMIT 1`,
          [userId, data.tenant_id],
        );

        const association = associationResult.rows[0];
        if (association) {
          if (association.is_deleted || association.deleted_at) {
            await client.query(
              `UPDATE public.user_tenant_associations
               SET role = $2,
                   is_active = true,
                   is_deleted = false,
                   deleted_at = NULL,
                   deleted_by = NULL,
                   updated_at = NOW(),
                   updated_by = $3,
                   version = COALESCE(version, 0) + 1
               WHERE id = $1`,
              [association.id, data.role, authUserId],
            );
          } else {
            throw request.server.httpErrors.conflict("USER_ALREADY_ASSOCIATED");
          }
        } else {
          await client.query(
            `INSERT INTO public.user_tenant_associations
              (user_id, tenant_id, role, is_active, created_by, updated_by)
             VALUES ($1, $2, $3, true, $4, $4)`,
            [userId, data.tenant_id, data.role, authUserId],
          );
        }

        await client.query("COMMIT");

        await emitMembershipCacheInvalidation({
          userId,
          reason: "TENANT_MEMBERSHIP_ADDED",
        });

        reply.status(201);
        return CreateTenantUserResponseSchema.parse({
          id: userId,
          username: data.username,
          email: data.email,
          message: "User created and associated successfully",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );

  app.post(
    "/v1/users/reset-password",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof ResetTenantUserPasswordSchema>).tenant_id,
        minRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: USERS_TAG,
        summary: "Reset a tenant user's password",
        body: ResetTenantUserPasswordJsonSchema,
        response: {
          200: ResetTenantUserPasswordResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      }),
    },
    async (request) => {
      const authUserId = request.auth.userId;
      if (!authUserId) {
        throw request.server.httpErrors.unauthorized("AUTHENTICATION_REQUIRED");
      }

      const data = ResetTenantUserPasswordSchema.parse(request.body);

      const association = await query<{ id: string }>(
        `SELECT id
         FROM public.user_tenant_associations
         WHERE user_id = $1
           AND tenant_id = $2
           AND deleted_at IS NULL
           AND COALESCE(is_deleted, false) = false
         LIMIT 1`,
        [data.user_id, data.tenant_id],
      );

      if (association.rows.length === 0) {
        throw request.server.httpErrors.notFound("USER_TENANT_ASSOCIATION_NOT_FOUND");
      }

      const passwordHash = await hashPassword(data.new_password ?? config.auth.defaultPassword);
      const updateResult = await query(TENANT_AUTH_UPDATE_PASSWORD_SQL, [
        passwordHash,
        data.user_id,
      ]);

      if (updateResult.rowCount === 0) {
        throw request.server.httpErrors.notFound("USER_NOT_FOUND");
      }

      await emitMembershipCacheInvalidation({
        userId: data.user_id,
        reason: "PASSWORD_UPDATED",
      });
      await resetTenantLoginState(data.user_id);

      return ResetTenantUserPasswordResponseSchema.parse({
        user_id: data.user_id,
        message: "Password reset successfully",
      });
    },
  );
};
