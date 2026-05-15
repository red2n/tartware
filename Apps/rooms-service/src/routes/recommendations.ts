import { RankRoomsBodySchema, RecommendationQuerySchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getRecommendations, rankRooms } from "../services/index.js";

export function registerRecommendationRoutes(app: FastifyInstance) {
  /**
   * GET /v1/recommendations
   *
   * Get personalized room recommendations for a guest.
   */
  app.get(
    "/v1/recommendations",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: {
        description: "Get personalized room recommendations",
        tags: ["recommendations"],
        querystring: {
          type: "object",
          required: ["tenant_id", "property_id", "check_in_date", "check_out_date"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            guest_id: { type: "string", format: "uuid" },
            check_in_date: { type: "string", format: "date" },
            check_out_date: { type: "string", format: "date" },
            adults: { type: "integer", minimum: 1, maximum: 10, default: 1 },
            children: { type: "integer", minimum: 0, maximum: 10, default: 0 },
            limit: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              requestId: { type: "string", format: "uuid" },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    roomId: { type: "string", format: "uuid" },
                    roomTypeId: { type: "string", format: "uuid" },
                    roomTypeName: { type: "string" },
                    roomNumber: { type: "string" },
                    floor: { type: "integer" },
                    viewType: { type: "string" },
                    baseRate: { type: "number" },
                    dynamicRate: { type: "number" },
                    totalPrice: { type: "number" },
                    amenities: { type: "array", items: { type: "string" } },
                    description: { type: "string" },
                    maxOccupancy: { type: "integer" },
                    bedType: { type: "string" },
                    squareFootage: { type: "number" },
                    isUpgrade: { type: "boolean" },
                    upgradeDiscount: { type: "number" },
                    relevanceScore: { type: "number" },
                    source: { type: "string" },
                  },
                },
              },
              totalCandidates: { type: "integer" },
              executionTimeMs: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const parsed = RecommendationQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw parsed.error;
      }

      const query = parsed.data;

      const result = await getRecommendations({
        tenantId: tenant_id,
        propertyId: query.property_id,
        guestId: query.guest_id,
        checkInDate: query.check_in_date,
        checkOutDate: query.check_out_date,
        adults: query.adults,
        children: query.children,
        limit: query.limit,
      });

      return reply.send(result);
    },
  );

  /**
   * POST /v1/recommendations/rank
   *
   * Rank a list of room IDs for a guest.
   * Use this when you already have available rooms and want personalized ordering.
   */
  app.post(
    "/v1/recommendations/rank",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: {
        description: "Rank a list of rooms for a guest (personalized ordering)",
        tags: ["recommendations"],
        body: {
          type: "object",
          required: ["tenant_id", "property_id", "check_in_date", "check_out_date", "room_ids"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            guest_id: { type: "string", format: "uuid" },
            check_in_date: { type: "string", format: "date" },
            check_out_date: { type: "string", format: "date" },
            adults: { type: "integer", minimum: 1, maximum: 10, default: 1 },
            children: { type: "integer", minimum: 0, maximum: 10, default: 0 },
            room_ids: {
              type: "array",
              items: { type: "string", format: "uuid" },
              minItems: 1,
              maxItems: 100,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              requestId: { type: "string", format: "uuid" },
              rankedRooms: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    roomId: { type: "string", format: "uuid" },
                    rank: { type: "integer" },
                    relevanceScore: { type: "number" },
                    reasons: {
                      type: "array",
                      items: { type: "string" },
                      description: "Human-readable reasons for the ranking",
                    },
                  },
                },
              },
              executionTimeMs: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.body);

      const parsed = RankRoomsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const body = parsed.data;

      const result = await rankRooms({
        tenantId: tenant_id,
        propertyId: body.property_id,
        guestId: body.guest_id,
        checkInDate: body.check_in_date,
        checkOutDate: body.check_out_date,
        adults: body.adults,
        children: body.children,
        roomIds: body.room_ids,
      });

      return reply.send(result);
    },
  );
}
