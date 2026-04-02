import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  BuildingItemSchema,
  type BuildingListQuery,
  BuildingListQuerySchema,
  BuildingListResponseSchema,
  BuildingParamsSchema,
  type CreateBuildingBody,
  CreateBuildingBodySchema,
  DeleteBuildingBodySchema,
  ProblemDetailSchema,
  type UpdateBuildingBody,
  UpdateBuildingBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import {
  createBuilding,
  deleteBuilding,
  listBuildings,
  updateBuilding,
} from "../services/building-service.js";

const BUILDINGS_TAG = "Buildings";
const BuildingListQueryJsonSchema = schemaFromZod(BuildingListQuerySchema, "BuildingListQuery");
const BuildingListResponseJsonSchema = schemaFromZod(
  BuildingListResponseSchema,
  "BuildingListResponse",
);
const CreateBuildingBodyJsonSchema = schemaFromZod(CreateBuildingBodySchema, "CreateBuildingBody");
const UpdateBuildingBodyJsonSchema = schemaFromZod(UpdateBuildingBodySchema, "UpdateBuildingBody");
const BuildingItemJsonSchema = schemaFromZod(BuildingItemSchema, "BuildingItem");
const ErrorResponseSchema = schemaFromZod(ProblemDetailSchema, "BuildingErrorResponse");

export const registerBuildingRoutes = (app: FastifyInstance): void => {
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
        body: schemaFromZod(DeleteBuildingBodySchema, "DeleteBuildingBody"),
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = BuildingParamsSchema.parse(request.params);
      const body = DeleteBuildingBodySchema.parse(request.body);

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
