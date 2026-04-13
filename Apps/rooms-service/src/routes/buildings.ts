import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { BuildingGridResponseSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  BuildingItemSchema,
  createBuilding,
  deleteBuilding,
  listBuildingGrid,
  listBuildings,
  updateBuilding,
} from "../services/building-service.js";

const BUILDINGS_TAG = "Buildings";

const BUILDING_TYPES = [
  "MAIN",
  "WING",
  "TOWER",
  "ANNEX",
  "VILLA",
  "COTTAGE",
  "BUNGALOW",
  "CONFERENCE",
  "SPA",
  "RECREATION",
  "OTHER",
] as const;

const BuildingListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
  building_type: z.string().optional(),
  search: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type BuildingListQuery = z.infer<typeof BuildingListQuerySchema>;

const BuildingListResponseSchema = z.array(BuildingItemSchema);
const BuildingListQueryJsonSchema = schemaFromZod(BuildingListQuerySchema, "BuildingListQuery");
const BuildingListResponseJsonSchema = schemaFromZod(
  BuildingListResponseSchema,
  "BuildingListResponse",
);
const BuildingGridResponseJsonSchema = schemaFromZod(
  BuildingGridResponseSchema,
  "BuildingGridResponse",
);

const CreateBuildingBodySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  building_code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, {
      message: "Building code must be alphanumeric (with _ or -)",
    })
    .transform((value) => value.toUpperCase()),
  building_name: z.string().min(1).max(200),
  building_type: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) => !value || BUILDING_TYPES.includes(value as (typeof BUILDING_TYPES)[number]),
      { message: "Invalid building type" },
    ),
  floor_count: z.number().int().positive().optional(),
  basement_floors: z.number().int().min(0).optional(),
  total_rooms: z.number().int().min(0).optional(),
  wheelchair_accessible: z.boolean().optional(),
  elevator_count: z.number().int().min(0).optional(),
  has_lobby: z.boolean().optional(),
  has_pool: z.boolean().optional(),
  has_gym: z.boolean().optional(),
  has_spa: z.boolean().optional(),
  has_restaurant: z.boolean().optional(),
  has_parking: z.boolean().optional(),
  parking_spaces: z.number().int().min(0).optional(),
  year_built: z.number().int().optional(),
  last_renovation_year: z.number().int().optional(),
  is_active: z.boolean().optional(),
  building_status: z.string().max(20).optional(),
  photo_url: z.string().max(500).optional(),
  guest_description: z.string().optional(),
  internal_notes: z.string().optional(),
  metadata: z.unknown().optional(),
});

type CreateBuildingBody = z.infer<typeof CreateBuildingBodySchema>;

const UpdateBuildingBodySchema = CreateBuildingBodySchema.partial().extend({
  tenant_id: z.string().uuid(),
  building_code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, {
      message: "Building code must be alphanumeric (with _ or -)",
    })
    .transform((value) => value.toUpperCase())
    .optional(),
  building_type: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) => !value || BUILDING_TYPES.includes(value as (typeof BUILDING_TYPES)[number]),
      { message: "Invalid building type" },
    ),
});

type UpdateBuildingBody = z.infer<typeof UpdateBuildingBodySchema>;

const CreateBuildingBodyJsonSchema = schemaFromZod(CreateBuildingBodySchema, "CreateBuildingBody");
const UpdateBuildingBodyJsonSchema = schemaFromZod(UpdateBuildingBodySchema, "UpdateBuildingBody");
const BuildingItemJsonSchema = schemaFromZod(BuildingItemSchema, "BuildingItem");
const ErrorResponseSchema = schemaFromZod(
  z.object({ type: z.string(), title: z.string(), status: z.number(), detail: z.string() }),
  "ErrorResponse",
);

const BuildingParamsSchema = z.object({
  buildingId: z.string().uuid(),
});

export const registerBuildingRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: BuildingListQuery }>(
    "/v1/buildings/grid",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BuildingListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: BUILDINGS_TAG,
        summary: "List lightweight buildings for the grid",
        querystring: BuildingListQueryJsonSchema,
        response: {
          200: BuildingGridResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const query = BuildingListQuerySchema.parse(request.query);
      const buildings = await listBuildingGrid({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
        isActive: query.is_active,
        buildingType: query.building_type,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });

      return BuildingGridResponseSchema.parse(buildings);
    },
  );

  app.get<{ Querystring: BuildingListQuery }>(
    "/v1/buildings",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BuildingListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: BUILDINGS_TAG,
        summary: "List buildings",
        querystring: BuildingListQueryJsonSchema,
        response: {
          200: BuildingListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const query = BuildingListQuerySchema.parse(request.query);
      const buildings = await listBuildings({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
        isActive: query.is_active,
        buildingType: query.building_type,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });

      return BuildingListResponseSchema.parse(buildings);
    },
  );

  app.post<{ Body: CreateBuildingBody }>(
    "/v1/buildings",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as CreateBuildingBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: BUILDINGS_TAG,
        summary: "Create a building",
        body: CreateBuildingBodyJsonSchema,
        response: {
          201: BuildingItemJsonSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = CreateBuildingBodySchema.parse(request.body);
      try {
        const created = await createBuilding({
          ...body,
          created_by: request.auth.userId ?? undefined,
        });
        return reply.status(201).send(created);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply.conflict("Building code already exists for this property");
          }
        }
        request.log.error({ err: error }, "Failed to create building");
        return reply.internalServerError("Failed to create building");
      }
    },
  );

  app.put<{
    Params: { buildingId: string };
    Body: UpdateBuildingBody;
  }>(
    "/v1/buildings/:buildingId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as UpdateBuildingBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: BUILDINGS_TAG,
        summary: "Update a building",
        params: schemaFromZod(BuildingParamsSchema, "BuildingParams"),
        body: UpdateBuildingBodyJsonSchema,
        response: {
          200: BuildingItemJsonSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = BuildingParamsSchema.parse(request.params);
      const body = UpdateBuildingBodySchema.parse(request.body);

      try {
        const updated = await updateBuilding({
          ...body,
          building_id: params.buildingId,
          updated_by: request.auth.userId ?? undefined,
        });

        if (!updated) {
          return reply.notFound("Building not found");
        }

        return reply.send(updated);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply.conflict("Building code already exists for this property");
          }
        }
        request.log.error({ err: error }, "Failed to update building");
        return reply.internalServerError("Failed to update building");
      }
    },
  );

  app.delete<{
    Params: { buildingId: string };
    Body: { tenant_id: string };
  }>(
    "/v1/buildings/:buildingId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: BUILDINGS_TAG,
        summary: "Delete a building",
        params: schemaFromZod(BuildingParamsSchema, "BuildingParams"),
        body: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "DeleteBuildingBody"),
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = BuildingParamsSchema.parse(request.params);
      const body = z.object({ tenant_id: z.string().uuid() }).parse(request.body);

      const deleted = await deleteBuilding({
        tenant_id: body.tenant_id,
        building_id: params.buildingId,
        deleted_by: request.auth.userId ?? undefined,
      });

      if (!deleted) {
        return reply.notFound("Building not found");
      }

      return reply.status(204).send();
    },
  );
};
