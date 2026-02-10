import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type { TenantRole } from "@tartware/schemas";
import { TenantRoleEnum, UserTenantAssociationWithDetailsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { query } from "../lib/db.js";
import { emitMembershipCacheInvalidation } from "../services/membership-cache-hooks.js";
import { listUserTenantAssociations } from "../services/user-tenant-association-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const AssociationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
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
const AssociationListQueryJsonSchema = schemaFromZod(
  AssociationListQuerySchema,
  "AssociationListQuery",
);
const AssociationListResponseJsonSchema = schemaFromZod(
  AssociationListResponseSchema,
  "AssociationListResponse",
);

const AssociationRoleUpdateSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: TenantRoleEnum,
});

const AssociationRoleUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: TenantRoleEnum,
  is_active: z.boolean(),
  message: z.string(),
});

const AssociationStatusUpdateSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  is_active: z.boolean(),
});

const AssociationStatusUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: TenantRoleEnum,
  is_active: z.boolean(),
  message: z.string(),
});

const AssociationRoleUpdateJsonSchema = schemaFromZod(
  AssociationRoleUpdateSchema,
  "AssociationRoleUpdate",
);
const AssociationRoleUpdateResponseJsonSchema = schemaFromZod(
  AssociationRoleUpdateResponseSchema,
  "AssociationRoleUpdateResponse",
);
const AssociationStatusUpdateJsonSchema = schemaFromZod(
  AssociationStatusUpdateSchema,
  "AssociationStatusUpdate",
);
const AssociationStatusUpdateResponseJsonSchema = schemaFromZod(
  AssociationStatusUpdateResponseSchema,
  "AssociationStatusUpdateResponse",
);

const ASSOCIATIONS_TAG = "User Tenant Associations";

export const registerUserTenantAssociationRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: AssociationListQuery }>(
    "/v1/user-tenant-associations",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as AssociationListQuery).tenant_id,
        minRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: ASSOCIATIONS_TAG,
        summary: "List user-tenant associations",
        querystring: AssociationListQueryJsonSchema,
        response: {
          200: AssociationListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { limit, offset, tenant_id, user_id, role, is_active } =
        AssociationListQuerySchema.parse(request.query);

      const associations = await listUserTenantAssociations({
        limit,
        offset,
        tenantId: tenant_id,
        userId: user_id,
        role,
        isActive: is_active,
      });

      const response = sanitizeForJson(associations);
      return AssociationListResponseSchema.parse(response);
    },
  );

  app.post(
    "/v1/user-tenant-associations/role",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof AssociationRoleUpdateSchema>).tenant_id,
        minRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: ASSOCIATIONS_TAG,
        summary: "Update a user's role within a tenant",
        body: AssociationRoleUpdateJsonSchema,
        response: {
          200: AssociationRoleUpdateResponseJsonSchema,
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

      const data = AssociationRoleUpdateSchema.parse(request.body);

      const result = await query<{
        id: string;
        role: string;
        is_active: boolean;
      }>(
        `UPDATE public.user_tenant_associations
         SET role = $3,
             updated_at = NOW(),
             updated_by = $4,
             version = COALESCE(version, 0) + 1
         WHERE user_id = $1
           AND tenant_id = $2
           AND deleted_at IS NULL
           AND COALESCE(is_deleted, false) = false
         RETURNING id, role, is_active`,
        [data.user_id, data.tenant_id, data.role, authUserId],
      );

      const association = result.rows[0];
      if (!association) {
        throw request.server.httpErrors.notFound("USER_TENANT_ASSOCIATION_NOT_FOUND");
      }

      await emitMembershipCacheInvalidation({
        userId: data.user_id,
        reason: "TENANT_MEMBERSHIP_MUTATED",
      });

      return AssociationRoleUpdateResponseSchema.parse({
        id: association.id,
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        role: data.role,
        is_active: association.is_active,
        message: "Tenant role updated successfully",
      });
    },
  );

  app.post(
    "/v1/user-tenant-associations/status",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof AssociationStatusUpdateSchema>).tenant_id,
        minRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: ASSOCIATIONS_TAG,
        summary: "Activate or deactivate a user's tenant access",
        body: AssociationStatusUpdateJsonSchema,
        response: {
          200: AssociationStatusUpdateResponseJsonSchema,
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

      const data = AssociationStatusUpdateSchema.parse(request.body);

      const result = await query<{
        id: string;
        role: string;
        is_active: boolean;
      }>(
        `UPDATE public.user_tenant_associations
         SET is_active = $3,
             updated_at = NOW(),
             updated_by = $4,
             version = COALESCE(version, 0) + 1
         WHERE user_id = $1
           AND tenant_id = $2
           AND deleted_at IS NULL
           AND COALESCE(is_deleted, false) = false
         RETURNING id, role, is_active`,
        [data.user_id, data.tenant_id, data.is_active, authUserId],
      );

      const association = result.rows[0];
      if (!association) {
        throw request.server.httpErrors.notFound("USER_TENANT_ASSOCIATION_NOT_FOUND");
      }

      await emitMembershipCacheInvalidation({
        userId: data.user_id,
        reason: data.is_active ? "TENANT_MEMBERSHIP_MUTATED" : "TENANT_MEMBERSHIP_REMOVED",
      });

      return AssociationStatusUpdateResponseSchema.parse({
        id: association.id,
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        role: association.role as TenantRole,
        is_active: association.is_active,
        message: data.is_active
          ? "Tenant access activated successfully"
          : "Tenant access deactivated successfully",
      });
    },
  );
};
