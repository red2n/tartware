import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getRecommendations, rankRooms } from "../services/index.js";

const recommendationQuerySchema = z.object({
  propertyId: z.string().uuid(),
  guestId: z.string().uuid().optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(10).default(1),
  children: z.coerce.number().int().min(0).max(10).default(0),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const rankRoomsBodySchema = z.object({
  propertyId: z.string().uuid(),
  guestId: z.string().uuid().optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(10).default(1),
  children: z.number().int().min(0).max(10).default(0),
  roomIds: z.array(z.string().uuid()).min(1).max(100),
});

type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
type RankRoomsBody = z.infer<typeof rankRoomsBodySchema>;

export function registerRecommendationRoutes(app: FastifyInstance) {
  /**
   * GET /v1/recommendations
   *
   * Get personalized room recommendations for a guest.
   */
  app.get(
    "/v1/recommendations",
    {
      schema: {
        description: "Get personalized room recommendations",
        tags: ["recommendations"],
        querystring: {
          type: "object",
          required: ["propertyId", "checkInDate", "checkOutDate"],
          properties: {
            propertyId: { type: "string", format: "uuid" },
            guestId: { type: "string", format: "uuid" },
            checkInDate: { type: "string", format: "date" },
            checkOutDate: { type: "string", format: "date" },
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
    async (
      request: FastifyRequest<{ Querystring: RecommendationQuery }>,
      reply: FastifyReply,
    ) => {
      const authContext = (request as unknown as { authContext?: { tenantId: string } }).authContext;
      if (!authContext?.tenantId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const parsed = recommendationQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.issues,
        });
      }

      const query = parsed.data;

      const result = await getRecommendations({
        tenantId: authContext.tenantId,
        propertyId: query.propertyId,
        guestId: query.guestId,
        checkInDate: query.checkInDate,
        checkOutDate: query.checkOutDate,
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
      schema: {
        description: "Rank a list of rooms for a guest (personalized ordering)",
        tags: ["recommendations"],
        body: {
          type: "object",
          required: ["propertyId", "checkInDate", "checkOutDate", "roomIds"],
          properties: {
            propertyId: { type: "string", format: "uuid" },
            guestId: { type: "string", format: "uuid" },
            checkInDate: { type: "string", format: "date" },
            checkOutDate: { type: "string", format: "date" },
            adults: { type: "integer", minimum: 1, maximum: 10, default: 1 },
            children: { type: "integer", minimum: 0, maximum: 10, default: 0 },
            roomIds: {
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
    async (
      request: FastifyRequest<{ Body: RankRoomsBody }>,
      reply: FastifyReply,
    ) => {
      const authContext = (request as unknown as { authContext?: { tenantId: string } }).authContext;
      if (!authContext?.tenantId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const parsed = rankRoomsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.issues,
        });
      }

      const body = parsed.data;

      const result = await rankRooms({
        tenantId: authContext.tenantId,
        propertyId: body.propertyId,
        guestId: body.guestId,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        adults: body.adults,
        children: body.children,
        roomIds: body.roomIds,
      });

      return reply.send(result);
    },
  );
}
