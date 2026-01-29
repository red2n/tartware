import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  CreateRoomsSchema,
  HousekeepingStatusEnum,
  MaintenanceStatusEnum,
  RoomStatusEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createRoom,
  deleteRoom,
  listRooms,
  RoomListItemSchema,
  updateRoom,
} from "../services/room-service.js";

const RoomListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        RoomStatusEnum.options
          .map((status) => status.toLowerCase())
          .includes(value),
      { message: "Invalid room status" },
    ),
  housekeeping_status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        HousekeepingStatusEnum.options
          .map((status) => status.toLowerCase())
          .includes(value),
      { message: "Invalid housekeeping status" },
    ),
  search: z.string().min(1).max(50).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

type RoomListQuery = z.infer<typeof RoomListQuerySchema>;

const RoomListResponseSchema = z.array(RoomListItemSchema);
const RoomListQueryJsonSchema = schemaFromZod(
  RoomListQuerySchema,
  "RoomListQuery",
);
const RoomListResponseJsonSchema = schemaFromZod(
  RoomListResponseSchema,
  "RoomListResponse",
);

const RoomListItemJsonSchema = schemaFromZod(
  RoomListItemSchema,
  "RoomListItem",
);

const CreateRoomBodySchema = CreateRoomsSchema.extend({
  status: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        RoomStatusEnum.options.includes(
          value as (typeof RoomStatusEnum.options)[number],
        ),
      { message: "Invalid room status" },
    ),
  housekeeping_status: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        HousekeepingStatusEnum.options.includes(
          value as (typeof HousekeepingStatusEnum.options)[number],
        ),
      { message: "Invalid housekeeping status" },
    ),
  maintenance_status: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        MaintenanceStatusEnum.options.includes(
          value as (typeof MaintenanceStatusEnum.options)[number],
        ),
      { message: "Invalid maintenance status" },
    ),
});

type CreateRoomBody = z.infer<typeof CreateRoomBodySchema>;

const CreateRoomBodyJsonSchema = schemaFromZod(
  CreateRoomBodySchema,
  "CreateRoomBody",
);

const ErrorResponseSchema = schemaFromZod(
  z.object({ message: z.string() }),
  "ErrorResponse",
);

const UpdateRoomBodySchema = CreateRoomBodySchema.partial().extend({
  tenant_id: z.string().uuid(),
});

type UpdateRoomBody = z.infer<typeof UpdateRoomBodySchema>;

const UpdateRoomBodyJsonSchema = schemaFromZod(
  UpdateRoomBodySchema,
  "UpdateRoomBody",
);

const RoomParamsSchema = z.object({
  roomId: z.string().uuid(),
});

const ROOMS_TAG = "Rooms";

export const registerRoomRoutes = (app: FastifyInstance): void => {
  app.post<{ Body: CreateRoomBody }>(
    "/v1/rooms",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as CreateRoomBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOMS_TAG,
        summary: "Create a room",
        body: CreateRoomBodyJsonSchema,
        response: {
          201: RoomListItemJsonSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = CreateRoomBodySchema.parse(request.body);
      try {
        const created = await createRoom({
          ...body,
          created_by: request.auth.userId ?? undefined,
        });

        return reply.status(201).send(created);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply
              .status(409)
              .send({ message: "Room already exists for this property" });
          }
        }
        request.log.error({ err: error }, "Failed to create room");
        return reply.status(500).send({ message: "Failed to create room" });
      }
    },
  );

  app.get<{ Querystring: RoomListQuery }>(
    "/v1/rooms",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as RoomListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOMS_TAG,
        summary: "List rooms with housekeeping filters",
        querystring: RoomListQueryJsonSchema,
        response: {
          200: RoomListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        status,
        housekeeping_status,
        search,
        limit,
      } = RoomListQuerySchema.parse(request.query);

      const rooms = await listRooms({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        housekeepingStatus: housekeeping_status,
        search,
        limit,
      });

      return RoomListResponseSchema.parse(rooms);
    },
  );

  app.put<{
    Params: { roomId: string };
    Body: UpdateRoomBody;
  }>(
    "/v1/rooms/:roomId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as UpdateRoomBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOMS_TAG,
        summary: "Update a room",
        params: schemaFromZod(RoomParamsSchema, "RoomParams"),
        body: UpdateRoomBodyJsonSchema,
        response: {
          200: RoomListItemJsonSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RoomParamsSchema.parse(request.params);
      const body = UpdateRoomBodySchema.parse(request.body);

      try {
        const updated = await updateRoom({
          ...body,
          room_id: params.roomId,
          updated_by: request.auth.userId ?? undefined,
        });

        if (!updated) {
          return reply.status(404).send({ message: "Room not found" });
        }

        return reply.send(updated);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply
              .status(409)
              .send({ message: "Room already exists for this property" });
          }
        }
        request.log.error({ err: error }, "Failed to update room");
        return reply.status(500).send({ message: "Failed to update room" });
      }
    },
  );

  app.delete<{
    Params: { roomId: string };
    Body: { tenant_id: string };
  }>(
    "/v1/rooms/:roomId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOMS_TAG,
        summary: "Delete a room",
        params: schemaFromZod(RoomParamsSchema, "RoomParams"),
        body: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "DeleteRoomBody",
        ),
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RoomParamsSchema.parse(request.params);
      const body = z
        .object({ tenant_id: z.string().uuid() })
        .parse(request.body);

      const deleted = await deleteRoom({
        tenant_id: body.tenant_id,
        room_id: params.roomId,
        deleted_by: request.auth.userId ?? undefined,
      });

      if (!deleted) {
        return reply.status(404).send({ message: "Room not found" });
      }

      return reply.status(204).send();
    },
  );
};
