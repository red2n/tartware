import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  CreateRoomsSchema,
  HousekeepingStatusEnum,
  MaintenanceStatusEnum,
  RoomStatusEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { config } from "../config.js";
import {
  createRoom,
  deleteRoom,
  getRoomById,
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
  // Recommendation context - when provided, rooms are ranked by recommendation score
  guest_id: z.string().uuid().optional(),
  check_in_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  check_out_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  adults: z.coerce.number().int().min(1).max(20).optional(),
  children: z.coerce.number().int().min(0).max(20).optional(),
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
        guest_id,
        check_in_date,
        check_out_date,
        adults,
        children,
      } = RoomListQuerySchema.parse(request.query);

      const rooms = await listRooms({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        housekeepingStatus: housekeeping_status,
        search,
        limit,
      });

      // If recommendation context is provided, fetch rankings from recommendation service
      const hasRecommendationContext =
        property_id && check_in_date && check_out_date;

      if (hasRecommendationContext && rooms.length > 0) {
        try {
          const roomIds = rooms.map((r) => r.room_id);
          const authHeader = request.headers.authorization;
          const response = await fetch(
            `${config.recommendationServiceUrl}/v1/recommendations/rank`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant-id": tenant_id,
                ...(authHeader ? { Authorization: authHeader } : {}),
              },
              body: JSON.stringify({
                propertyId: property_id,
                guestId: guest_id,
                checkInDate: check_in_date,
                checkOutDate: check_out_date,
                adults: adults ?? 1,
                children: children ?? 0,
                roomIds,
              }),
            },
          );

          if (response.ok) {
            const rankResult = (await response.json()) as {
              rankedRooms: Array<{
                roomId: string;
                rank: number;
                relevanceScore: number;
                reasons: string[];
              }>;
            };

            // Create a map of room rankings
            const rankMap = new Map<
              string,
              { rank: number; score: number; reasons: string[] }
            >();
            for (const ranked of rankResult.rankedRooms) {
              rankMap.set(ranked.roomId, {
                rank: ranked.rank,
                score: ranked.relevanceScore,
                reasons: ranked.reasons,
              });
            }

            // Merge recommendation data into rooms and sort by rank
            const enrichedRooms = rooms.map((room) => {
              const ranking = rankMap.get(room.room_id);
              return {
                ...room,
                recommendation_rank: ranking?.rank,
                recommendation_score: ranking?.score,
                recommendation_reasons: ranking?.reasons,
              };
            });

            // Sort by recommendation rank (rooms with rank first, then unranked)
            enrichedRooms.sort((a, b) => {
              if (a.recommendation_rank && b.recommendation_rank) {
                return a.recommendation_rank - b.recommendation_rank;
              }
              if (a.recommendation_rank) return -1;
              if (b.recommendation_rank) return 1;
              return 0;
            });

            return RoomListResponseSchema.parse(enrichedRooms);
          }
        } catch (error) {
          // Log error but don't fail the request - return unranked rooms
          request.log.warn(
            { err: error },
            "Failed to fetch room recommendations, returning unranked",
          );
        }
      }

      return RoomListResponseSchema.parse(rooms);
    },
  );

  // Schema for single room query with optional recommendation context
  const RoomByIdQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    // Recommendation context - when provided, room includes recommendation score
    guest_id: z.string().uuid().optional(),
    check_in_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
      .optional(),
    check_out_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
      .optional(),
    adults: z.coerce.number().int().positive().max(20).optional(),
    children: z.coerce.number().int().nonnegative().max(10).optional(),
  });

  type RoomByIdQuery = z.infer<typeof RoomByIdQuerySchema>;

  app.get<{
    Params: { roomId: string };
    Querystring: RoomByIdQuery;
  }>(
    "/v1/rooms/:roomId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as RoomByIdQuery).tenant_id,
        minRole: "VIEWER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ROOMS_TAG,
        summary: "Get a room by ID with optional recommendation scoring",
        description:
          "Returns a single room by ID. When recommendation context (check_in_date, check_out_date) is provided, includes recommendation_score and recommendation_reasons.",
        params: schemaFromZod(RoomParamsSchema, "RoomParams"),
        querystring: schemaFromZod(RoomByIdQuerySchema, "RoomByIdQuery"),
        response: {
          200: RoomListItemJsonSchema,
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RoomParamsSchema.parse(request.params);
      const {
        tenant_id,
        guest_id,
        check_in_date,
        check_out_date,
        adults,
        children,
      } = RoomByIdQuerySchema.parse(request.query);

      const room = await getRoomById({
        tenantId: tenant_id,
        roomId: params.roomId,
      });

      if (!room) {
        return reply.status(404).send({ message: "Room not found" });
      }

      // If recommendation context is provided, fetch ranking from recommendation service
      const hasRecommendationContext = check_in_date && check_out_date;

      if (hasRecommendationContext) {
        try {
          const authHeader = request.headers.authorization;
          const response = await fetch(
            `${config.recommendationServiceUrl}/v1/recommendations/rank`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant-id": tenant_id,
                ...(authHeader ? { Authorization: authHeader } : {}),
              },
              body: JSON.stringify({
                propertyId: room.property_id,
                guestId: guest_id,
                checkInDate: check_in_date,
                checkOutDate: check_out_date,
                adults: adults ?? 1,
                children: children ?? 0,
                roomIds: [room.room_id],
              }),
            },
          );

          if (response.ok) {
            const rankResult = (await response.json()) as {
              rankedRooms: Array<{
                roomId: string;
                rank: number;
                relevanceScore: number;
                reasons: string[];
              }>;
            };

            const ranking = rankResult.rankedRooms.find(
              (r) => r.roomId === room.room_id,
            );

            if (ranking) {
              return {
                ...room,
                recommendation_rank: ranking.rank,
                recommendation_score: ranking.relevanceScore,
                recommendation_reasons: ranking.reasons,
              };
            }
          }
        } catch (error) {
          // Log error but don't fail the request - return room without ranking
          request.log.warn(
            { err: error },
            "Failed to fetch room recommendation, returning unranked",
          );
        }
      }

      return room;
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
