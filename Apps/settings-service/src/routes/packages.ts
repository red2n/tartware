import { buildRouteSchema, type JsonSchema, schemaFromZod } from "@tartware/openapi";
import {
  CreatePackageBodySchema,
  CreatePackageComponentBodySchema,
  CreatePackageResponseSchema,
  PackageComponentListItemSchema,
  PackageListItemSchema,
  PackageListResponseSchema,
  PackageTypeEnum,
  UpdatePackageBodySchema,
} from "@tartware/schemas";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

import {
  createPackage,
  createPackageComponent,
  getPackageById,
  getPackageComponents,
  listPackages,
  updatePackage,
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
const createPackageBody: JsonSchema = schemaFromZod(CreatePackageBodySchema, "CreatePackageBody");
const createdResponse: JsonSchema = schemaFromZod(CreatePackageResponseSchema, "CreatePackageResponse");
const updatePackageBody: JsonSchema = schemaFromZod(UpdatePackageBodySchema, "UpdatePackageBody");
const createComponentBody: JsonSchema = schemaFromZod(CreatePackageComponentBodySchema, "CreatePackageComponentBody");

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
  if (process.env.DISABLE_AUTH === "true") {
    return true;
  }
  if (!request.authUser) {
    throw reply.server.httpErrors.unauthorized("Unauthorized");
  }
  if (!hasScope(request.authUser, scope)) {
    throw reply.server.httpErrors.forbidden(`Missing scope ${scope}`);
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

  /**
   * Create a new package
   */
  app.post(
    "/v1/packages",
    {
      schema: buildRouteSchema({
        tag: PACKAGES_TAG,
        summary: "Create a new package",
        description: "Creates a new room or service package with initial configuration",
        body: createPackageBody,
        response: {
          201: createdResponse,
          400: errorResponse,
          409: errorResponse,
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:write")) {
        return;
      }

      const body = CreatePackageBodySchema.parse(request.body);

      if (body.valid_to <= body.valid_from) {
        return reply.badRequest("valid_to must be after valid_from");
      }

      if (body.max_nights != null && body.max_nights < body.min_nights) {
        return reply.badRequest("max_nights cannot be less than min_nights");
      }

      if (body.max_guests != null && body.max_guests < body.min_guests) {
        return reply.badRequest("max_guests cannot be less than min_guests");
      }

      try {
        const packageId = await createPackage({
          tenantId: body.tenant_id,
          propertyId: body.property_id,
          packageName: body.package_name,
          packageCode: body.package_code,
          packageType: body.package_type,
          shortDescription: body.short_description,
          validFrom: body.valid_from,
          validTo: body.valid_to,
          minNights: body.min_nights,
          maxNights: body.max_nights,
          minGuests: body.min_guests,
          maxGuests: body.max_guests,
          pricingModel: body.pricing_model,
          basePrice: body.base_price,
          includesBreakfast: body.includes_breakfast,
          includesLunch: body.includes_lunch,
          includesDinner: body.includes_dinner,
          includesParking: body.includes_parking,
          includesWifi: body.includes_wifi,
          includesAirportTransfer: body.includes_airport_transfer,
          refundable: body.refundable,
          freeCancellationDays: body.free_cancellation_days,
          totalInventory: body.total_inventory,
          createdBy: request.authUser?.sub,
        });

        return reply.status(201).send({
          package_id: packageId,
          message: "Package created successfully",
        });
      } catch (error: unknown) {
        const pgError = error as { code?: string; constraint?: string };
        if (pgError.code === "23505") {
          return reply.conflict("A package with this code already exists");
        }
        throw error;
      }
    },
  );

  /**
   * Create a new package component
   */
  app.post(
    "/v1/packages/:packageId/components",
    {
      schema: buildRouteSchema({
        tag: PACKAGES_TAG,
        summary: "Add a component to a package",
        description: "Creates a new service, amenity, or other component within a package",
        params: packageParamsSchema,
        body: createComponentBody,
        response: {
          201: createdResponse,
          404: errorResponse,
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:write")) {
        return;
      }

      const { packageId } = PackageParamsSchema.parse(request.params);
      const body = CreatePackageComponentBodySchema.parse(request.body);

      // Verify the package exists and belongs to tenant
      const pkg = await getPackageById({
        packageId,
        tenantId: body.tenant_id,
      });

      if (!pkg) {
        return reply.notFound("Package not found");
      }

      const componentId = await createPackageComponent({
        packageId,
        componentType: body.component_type,
        componentName: body.component_name,
        componentDescription: body.component_description,
        quantity: body.quantity,
        pricingType: body.pricing_type,
        unitPrice: body.unit_price,
        isIncluded: body.is_included,
        isOptional: body.is_optional,
        isMandatory: body.is_mandatory,
        deliveryTiming: body.delivery_timing,
        deliveryLocation: body.delivery_location,
        displayOrder: body.display_order,
        createdBy: request.authUser?.sub,
      });

      return reply.status(201).send({
        package_id: componentId,
        message: "Component added successfully",
      });
    },
  );

  /**
   * Update a package (activate/deactivate, toggle inclusions)
   */
  app.patch(
    "/v1/packages/:packageId",
    {
      schema: buildRouteSchema({
        tag: PACKAGES_TAG,
        summary: "Update a package",
        description: "Updates package status (activate/deactivate) and inclusion flags",
        params: packageParamsSchema,
        body: updatePackageBody,
        response: {
          200: createdResponse,
          404: errorResponse,
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:write")) {
        return;
      }

      const { packageId } = PackageParamsSchema.parse(request.params);
      const body = UpdatePackageBodySchema.parse(request.body);

      const updated = await updatePackage({
        packageId,
        tenantId: body.tenant_id,
        isActive: body.is_active,
        includesBreakfast: body.includes_breakfast,
        includesLunch: body.includes_lunch,
        includesDinner: body.includes_dinner,
        includesParking: body.includes_parking,
        includesWifi: body.includes_wifi,
        includesAirportTransfer: body.includes_airport_transfer,
        updatedBy: request.authUser?.sub,
      });

      if (!updated) {
        return reply.notFound("Package not found");
      }

      return { package_id: updated, message: "Package updated successfully" };
    },
  );
};

export default fp(packagesRoutes, {
  name: "packages-routes",
});
