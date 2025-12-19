import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { HousekeepingStatusEnum, RoomStatusEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listRooms, RoomListItemSchema } from "../services/room-service.js";

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

const ROOMS_TAG = "Rooms";

export const registerRoomRoutes = (app: FastifyInstance): void => {
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
};
