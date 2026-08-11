import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type { UserListQuery } from "@tartware/schemas";
import {
  CreateTenantUserResponseSchema,
  CreateTenantUserSchema,
  ResetTenantUserPasswordResponseSchema,
  ResetTenantUserPasswordSchema,
  TenantUserListResponseSchema,
  UserListQuerySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { pool, query } from "../lib/db.js";
import { emitMembershipCacheInvalidation } from "../services/membership-cache-hooks.js";
import {
  assertPasswordMeetsPolicy,
  PasswordPolicyError,
} from "../services/password-policy-service.js";
import { resetTenantLoginState } from "../services/tenant-auth-security-service.js";
import { listUsers } from "../services/user-service.js";
import { TENANT_AUTH_UPDATE_PASSWORD_SQL } from "../sql/tenant-auth-queries.js";
import { hashPassword } from "../utils/password.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const UserListQueryJsonSchema = schemaFromZod(UserListQuerySchema, "UserListQuery");
const UserListResponseJsonSchema = schemaFromZod(TenantUserListResponseSchema, "UserListResponse");

const CreateTenantUserJsonSchema = schemaFromZod(CreateTenantUserSchema, "CreateTenantUser");
const CreateTenantUserResponseJsonSchema = schemaFromZod(
  CreateTenantUserResponseSchema,
  "CreateTenantUserResponse",
);

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
      return TenantUserListResponseSchema.parse(response);
    },
  );

  app.post(
    "/v1/users",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
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
        throw request.server.httpErrors.unauthorized(
          "You must be logged in to access this resource.",
        );
      }

      const data = CreateTenantUserSchema.parse(request.body);
      const passwordToSet = data.password ?? config.auth.defaultPassword;

      // Enforce the tenant's password policy server-side. The client checks the
      // same rules for feedback, but that is bypassed by calling this directly.
      //
      // Only caller-supplied passwords are checked. Falling back to the system
      // default issues a first-use temporary credential, which login already
      // flags via `mustChangePassword` and which cannot be re-set as a real
      // password — the carve-out PCI DSS 4.0 (8.3.5) allows for first-use.
      if (data.password) {
        try {
          await assertPasswordMeetsPolicy(data.tenant_id, data.password);
        } catch (error) {
          if (error instanceof PasswordPolicyError) {
            throw request.server.httpErrors.badRequest(error.message);
          }
          throw error;
        }
      }

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
              (tenant_id, username, email, password_hash, first_name, last_name, phone, is_active, is_verified, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, $8, $8)
             RETURNING id, username, email`,
            [
              data.tenant_id,
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
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
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
        throw request.server.httpErrors.unauthorized(
          "You must be logged in to access this resource.",
        );
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

      // As above: an admin-supplied password must meet policy; omitting it
      // resets the account to the first-use temporary credential.
      const newPassword = data.new_password ?? config.auth.defaultPassword;
      if (data.new_password) {
        try {
          await assertPasswordMeetsPolicy(data.tenant_id, data.new_password);
        } catch (error) {
          if (error instanceof PasswordPolicyError) {
            throw request.server.httpErrors.badRequest(error.message);
          }
          throw error;
        }
      }

      const passwordHash = await hashPassword(newPassword);
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
