import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type CreateRoomTypeBody,
  CreateRoomTypeBodySchema,
  DeleteRoomTypeBodySchema,
  ProblemDetailSchema,
  RoomTypeItemSchema,
  type RoomTypeListQuery,
  RoomTypeListQuerySchema,
  RoomTypeListResponseSchema,
  RoomTypeParamsSchema,
  type UpdateRoomTypeBody,
  UpdateRoomTypeBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { ReferenceDataCompatibilityError } from "../services/reference-data-service.js";
import {
  createRoomType,
  deleteRoomType,
  listRoomTypes,
  updateRoomType,
} from "../services/room-type-service.js";

const ROOM_TYPES_TAG = "Room Types";
const RoomTypeListQueryJsonSchema = schemaFromZod(RoomTypeListQuerySchema, "RoomTypeListQuery");
const RoomTypeListResponseJsonSchema = schemaFromZod(
  RoomTypeListResponseSchema,
  "RoomTypeListResponse",
);
const CreateRoomTypeBodyJsonSchema = schemaFromZod(CreateRoomTypeBodySchema, "CreateRoomTypeBody");
const UpdateRoomTypeBodyJsonSchema = schemaFromZod(UpdateRoomTypeBodySchema, "UpdateRoomTypeBody");
const RoomTypeItemJsonSchema = schemaFromZod(RoomTypeItemSchema, "RoomTypeItem");
const ErrorResponseSchema = schemaFromZod(ProblemDetailSchema, "RoomTypeErrorResponse");

export const registerRoomTypeRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: RoomTypeListQuery }>(
    "/v1/room-types",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RoomTypeListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOM_TYPES_TAG,
        summary: "List room types",
        querystring: RoomTypeListQueryJsonSchema,
        response: {
          200: RoomTypeListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const query = RoomTypeListQuerySchema.parse(request.query);
      const roomTypes = await listRoomTypes({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
        isActive: query.is_active,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });

      return RoomTypeListResponseSchema.parse(roomTypes);
    },
  );

  app.post<{ Body: CreateRoomTypeBody }>(
    "/v1/room-types",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as CreateRoomTypeBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOM_TYPES_TAG,
        summary: "Create a room type",
        body: CreateRoomTypeBodyJsonSchema,
        response: {
          201: RoomTypeItemJsonSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = CreateRoomTypeBodySchema.parse(request.body);
      try {
        const created = await createRoomType({
          ...body,
          created_by: request.auth.userId ?? undefined,
        });
        return reply.status(201).send(created);
      } catch (error) {
        if (error instanceof ReferenceDataCompatibilityError) {
          return reply.badRequest(error.message);
        }
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply.conflict("Room type code already exists for this property");
          }
        }
        request.log.error({ err: error }, "Failed to create room type");
        return reply.internalServerError("Failed to create room type");
      }
    },
  );

  app.put<{
    Params: { roomTypeId: string };
    Body: UpdateRoomTypeBody;
  }>(
    "/v1/room-types/:roomTypeId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as UpdateRoomTypeBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOM_TYPES_TAG,
        summary: "Update a room type",
        params: schemaFromZod(RoomTypeParamsSchema, "RoomTypeParams"),
        body: UpdateRoomTypeBodyJsonSchema,
        response: {
          200: RoomTypeItemJsonSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RoomTypeParamsSchema.parse(request.params);
      const body = UpdateRoomTypeBodySchema.parse(request.body);

      try {
        const updated = await updateRoomType({
          ...body,
          room_type_id: params.roomTypeId,
          updated_by: request.auth.userId ?? undefined,
        });

        if (!updated) {
          return reply.notFound("Room type not found");
        }

        return reply.send(updated);
      } catch (error) {
        if (error instanceof ReferenceDataCompatibilityError) {
          return reply.badRequest(error.message);
        }
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply.conflict("Room type code already exists for this property");
          }
        }
        request.log.error({ err: error }, "Failed to update room type");
        return reply.internalServerError("Failed to update room type");
      }
    },
  );

  app.delete<{
    Params: { roomTypeId: string };
    Body: { tenant_id: string };
  }>(
    "/v1/room-types/:roomTypeId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOM_TYPES_TAG,
        summary: "Delete a room type",
        params: schemaFromZod(RoomTypeParamsSchema, "RoomTypeParams"),
        body: schemaFromZod(DeleteRoomTypeBodySchema, "DeleteRoomTypeBody"),
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RoomTypeParamsSchema.parse(request.params);
      const body = DeleteRoomTypeBodySchema.parse(request.body);

      const deleted = await deleteRoomType({
        tenant_id: body.tenant_id,
        room_type_id: params.roomTypeId,
        deleted_by: request.auth.userId ?? undefined,
      });

      if (!deleted) {
        return reply.notFound("Room type not found");
      }

      return reply.status(204).send();
    },
  );
};
