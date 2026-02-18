import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type { AssociationListQuery, TenantRole } from "@tartware/schemas";
import {
  AssociationListQuerySchema,
  AssociationListResponseSchema,
  AssociationRoleUpdateResponseSchema,
  AssociationRoleUpdateSchema,
  AssociationStatusUpdateResponseSchema,
  AssociationStatusUpdateSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { query } from "../lib/db.js";
import { emitMembershipCacheInvalidation } from "../services/membership-cache-hooks.js";
import { listUserTenantAssociations } from "../services/user-tenant-association-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const AssociationListQueryJsonSchema = schemaFromZod(
  AssociationListQuerySchema,
  "AssociationListQuery",
);
const AssociationListResponseJsonSchema = schemaFromZod(
  AssociationListResponseSchema,
  "AssociationListResponse",
);

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
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
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
        throw request.server.httpErrors.unauthorized(
          "You must be logged in to access this resource.",
        );
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
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
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
        throw request.server.httpErrors.unauthorized(
          "You must be logged in to access this resource.",
        );
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
