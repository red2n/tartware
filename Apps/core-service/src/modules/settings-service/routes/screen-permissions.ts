import { buildRouteSchema, type JsonSchema, schemaFromZod } from "@tartware/openapi";
import {
  AllRoleScreenPermissionsResponseSchema,
  RoleScreenPermissionsResponseSchema,
  TenantRoleEnum,
  UpsertScreenPermissionsSchema,
} from "@tartware/schemas";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

import {
  getAllScreenPermissions,
  getScreenPermissions,
  upsertScreenPermissions,
} from "../repositories/screen-permissions-repository.js";

const TAG = "Screen Permissions";

const TenantQuerySchema = z.object({ tenant_id: z.string().uuid() });
const RoleParamsSchema = z.object({
  role: TenantRoleEnum,
});

const TenantQueryJson: JsonSchema = schemaFromZod(
  TenantQuerySchema,
  "ScreenPermissionsTenantQuery",
);
const RoleParamsJson: JsonSchema = schemaFromZod(RoleParamsSchema, "ScreenPermissionsRoleParams");
const SingleRoleResponseJson: JsonSchema = schemaFromZod(
  RoleScreenPermissionsResponseSchema,
  "RoleScreenPermissionsResponse",
);
const AllRolesResponseJson: JsonSchema = schemaFromZod(
  AllRoleScreenPermissionsResponseSchema,
  "AllRoleScreenPermissionsResponse",
);
const UpsertBodyJson: JsonSchema = schemaFromZod(
  UpsertScreenPermissionsSchema,
  "UpsertScreenPermissionsBody",
);

const screenPermissionsRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/settings/screen-permissions
   * Fetch screen permissions for ALL roles in the tenant.
   */
  /** Resolve tenantId from JWT (normal flow) or query param (DISABLE_AUTH dev mode). */
  const resolveTenantId = (request: FastifyRequest): string | undefined => {
    return (
      request.authUser?.tenantId ?? (request.query as Record<string, string>).tenant_id ?? undefined
    );
  };

  app.get(
    "/v1/settings/screen-permissions",
    {
      schema: buildRouteSchema({
        tag: TAG,
        summary: "List screen permissions for all roles",
        querystring: TenantQueryJson,
        response: { 200: AllRolesResponseJson },
      }),
    },
    async (request) => {
      const tenantId = resolveTenantId(request);
      if (!tenantId) return { permissions: [] };

      const permsMap = await getAllScreenPermissions(tenantId);
      const permissions = Object.entries(permsMap).map(([role, screens]) => ({
        role,
        screens,
      }));

      return AllRoleScreenPermissionsResponseSchema.parse({ permissions });
    },
  );

  /**
   * GET /v1/settings/screen-permissions/:role
   * Fetch screen permissions for a specific role in the tenant.
   */
  app.get(
    "/v1/settings/screen-permissions/:role",
    {
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Get screen permissions for a role",
        params: RoleParamsJson,
        querystring: TenantQueryJson,
        response: { 200: SingleRoleResponseJson },
      }),
    },
    async (request: FastifyRequest<{ Params: { role: string } }>) => {
      const tenantId = resolveTenantId(request);
      if (!tenantId) return { role: "VIEWER", screens: [] };

      const role = TenantRoleEnum.parse(request.params.role);
      const screens = await getScreenPermissions(tenantId, role);

      return RoleScreenPermissionsResponseSchema.parse({ role, screens });
    },
  );

  /**
   * PUT /v1/settings/screen-permissions
   * Upsert screen permissions for a role.
   * Only ADMIN or OWNER can update.
   */
  app.put(
    "/v1/settings/screen-permissions",
    {
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Update screen permissions for a role",
        querystring: TenantQueryJson,
        body: UpsertBodyJson,
        response: { 200: SingleRoleResponseJson },
      }),
    },
    async (request, reply) => {
      const tenantId = resolveTenantId(request);
      if (!tenantId) return reply.forbidden("Tenant context required");

      const membership = request.tenantMembership;
      if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
        return reply.forbidden("Only ADMIN or OWNER can update screen permissions");
      }

      const body = UpsertScreenPermissionsSchema.parse(request.body);

      await upsertScreenPermissions(tenantId, body.role, body.screens, request.authUser?.sub);

      const screens = await getScreenPermissions(tenantId, body.role);
      return RoleScreenPermissionsResponseSchema.parse({ role: body.role, screens });
    },
  );
};

export default fp(screenPermissionsRoutes);
