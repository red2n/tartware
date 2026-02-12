import { buildRouteSchema, type JsonSchema, schemaFromZod } from "@tartware/openapi";
import {
  PackageComponentListItemSchema,
  PackageListItemSchema,
  PackageListResponseSchema,
  PackageTypeEnum,
} from "@tartware/schemas";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

import {
  getPackageById,
  getPackageComponents,
  listPackages,
} from "../repositories/packages-repository.js";
import type { AuthUser } from "../types/auth.js";

const PACKAGES_TAG = "Packages";

// =====================================================
// QUERY SCHEMAS
// =====================================================

const PackageListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  package_type: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        PackageTypeEnum.options.includes(value as (typeof PackageTypeEnum.options)[number]),
      { message: "Invalid package type" },
    ),
  is_active: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  is_published: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  is_featured: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  valid_on: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "valid_on must be a valid ISO date string",
    }),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

const PackageParamsSchema = z.object({
  packageId: z.string().uuid(),
});

const TenantQuerySchema = z.object({
  tenant_id: z.string().uuid(),
});

// =====================================================
// JSON SCHEMAS
// =====================================================

const packageListQuery: JsonSchema = schemaFromZod(PackageListQuerySchema, "PackageListQuery");
const packageListResponse: JsonSchema = schemaFromZod(
  PackageListResponseSchema,
  "PackageListResponse",
);
const packageItemResponse: JsonSchema = schemaFromZod(PackageListItemSchema, "PackageListItem");
const packageParamsSchema: JsonSchema = schemaFromZod(PackageParamsSchema, "PackageParams");
const tenantQuerySchema: JsonSchema = schemaFromZod(TenantQuerySchema, "TenantQuery");
const packageComponentsResponse: JsonSchema = schemaFromZod(
  z.object({
    data: z.array(PackageComponentListItemSchema),
    meta: z.object({
      count: z.number().int().nonnegative(),
    }),
  }),
  "PackageComponentsResponse",
);
const errorResponse: JsonSchema = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
};

// =====================================================
// AUTH HELPERS
// =====================================================

const hasScope = (user: AuthUser | undefined, requiredScope: string) => {
  if (!user) {
    return false;
  }
  if (!user.scope) {
    return false;
  }
  const normalizedScopes = Array.isArray(user.scope) ? user.scope : user.scope.split(" ");
  return normalizedScopes.includes(requiredScope);
};

const enforceScope = (
  request: FastifyRequest,
  reply: FastifyReply,
  scope: string,
): request is FastifyRequest & { authUser: AuthUser } => {
  if (!request.authUser) {
    return reply.unauthorized("Unauthorized") as never;
  }
  if (!hasScope(request.authUser, scope)) {
    return reply.forbidden(`Missing scope ${scope}`) as never;
  }
  return true;
};

// =====================================================
// ROUTES
// =====================================================

const packagesRoutes: FastifyPluginAsync = async (app) => {
  /**
   * List packages with optional filters
   */
  app.get(
    "/v1/packages",
    {
      schema: buildRouteSchema({
        tag: PACKAGES_TAG,
        summary: "List packages",
        description:
          "Retrieves room and service packages with filtering by type, status, and validity",
        querystring: packageListQuery,
        response: {
          200: packageListResponse,
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:read")) {
        return;
      }

      const {
        tenant_id,
        property_id,
        package_type,
        is_active,
        is_published,
        is_featured,
        valid_on,
        limit,
      } = PackageListQuerySchema.parse(request.query);

      const packages = await listPackages({
        tenantId: tenant_id,
        propertyId: property_id,
        packageType: package_type,
        isActive: is_active,
        isPublished: is_published,
        isFeatured: is_featured,
        validOn: valid_on,
        limit,
      });

      return {
        data: packages,
        meta: { count: packages.length },
      };
    },
  );

  /**
   * Get package by ID
   */
  app.get(
    "/v1/packages/:packageId",
    {
      schema: buildRouteSchema({
        tag: PACKAGES_TAG,
        summary: "Get package by ID",
        description: "Retrieves detailed information for a specific package",
        params: packageParamsSchema,
        querystring: tenantQuerySchema,
        response: {
          200: packageItemResponse,
          404: errorResponse,
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:read")) {
        return;
      }

      const { packageId } = PackageParamsSchema.parse(request.params);
      const { tenant_id } = TenantQuerySchema.parse(request.query);

      const pkg = await getPackageById({
        packageId,
        tenantId: tenant_id,
      });

      if (!pkg) {
        return reply.notFound("Package not found");
      }

      return pkg;
    },
  );

  /**
   * Get package components
   */
  app.get(
    "/v1/packages/:packageId/components",
    {
      schema: buildRouteSchema({
        tag: PACKAGES_TAG,
        summary: "Get package components",
        description: "Retrieves the services and amenities included in a package",
        params: packageParamsSchema,
        querystring: tenantQuerySchema,
        response: {
          200: packageComponentsResponse,
          404: errorResponse,
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:read")) {
        return;
      }

      const { packageId } = PackageParamsSchema.parse(request.params);
      const { tenant_id } = TenantQuerySchema.parse(request.query);

      // First verify the package exists and belongs to tenant
      const pkg = await getPackageById({
        packageId,
        tenantId: tenant_id,
      });

      if (!pkg) {
        return reply.notFound("Package not found");
      }

      const components = await getPackageComponents({ packageId });

      return {
        data: components,
        meta: { count: components.length },
      };
    },
  );
};

export default fp(packagesRoutes, {
  name: "packages-routes",
});
