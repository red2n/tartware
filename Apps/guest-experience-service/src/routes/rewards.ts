import type { FastifyInstance } from "fastify";
import {
  listGuestRedemptions,
  listRewardCatalog,
  RewardServiceError,
  redeemReward,
} from "../services/reward-service.js";

const REWARDS_TAG = "Loyalty Rewards";

/**
 * Register reward catalog and redemption endpoints.
 */
export const registerRewardRoutes = (app: FastifyInstance): void => {
  /**
   * GET /v1/self-service/rewards
   * List available rewards from the catalog.
   */
  app.get(
    "/v1/self-service/rewards",
    {
      schema: {
        tags: [REWARDS_TAG],
        summary: "List available rewards",
        description: "Returns the reward catalog filtered by tenant, property, and guest tier.",
      },
    },
    async (request, reply) => {
      const q = request.query as Record<string, string>;
      const tenantId = (request as { tenantId?: string }).tenantId ?? q.tenant_id;
      if (!tenantId) {
        return reply.status(400).send({ error: "tenant_id is required" });
      }

      const result = await listRewardCatalog({
        tenantId,
        propertyId: q.property_id,
        guestTier: q.tier,
        category: q.category,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      });

      return reply.send(result);
    },
  );

  /**
   * POST /v1/self-service/rewards/redeem
   * Redeem a reward using loyalty points.
   */
  app.post(
    "/v1/self-service/rewards/redeem",
    {
      schema: {
        tags: [REWARDS_TAG],
        summary: "Redeem a reward",
        description: "Deducts loyalty points and creates a redemption record for the reward.",
      },
    },
    async (request, reply) => {
      const body = request.body as {
        tenant_id?: string;
        property_id: string;
        guest_id: string;
        reward_id: string;
        reservation_id?: string;
      };
      const tenantId = (request as { tenantId?: string }).tenantId ?? body.tenant_id;
      if (!tenantId || !body.property_id || !body.guest_id || !body.reward_id) {
        return reply
          .status(400)
          .send({ error: "tenant_id, property_id, guest_id, and reward_id are required" });
      }

      try {
        const result = await redeemReward({
          tenantId,
          propertyId: body.property_id,
          guestId: body.guest_id,
          rewardId: body.reward_id,
          reservationId: body.reservation_id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof RewardServiceError) {
          const status = err.code === "REWARD_NOT_FOUND" ? 404 : 400;
          return reply.status(status).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  /**
   * GET /v1/self-service/rewards/redemptions
   * List a guest's past reward redemptions.
   */
  app.get(
    "/v1/self-service/rewards/redemptions",
    {
      schema: {
        tags: [REWARDS_TAG],
        summary: "List guest redemptions",
        description: "Returns a paginated list of the guest's reward redemptions.",
      },
    },
    async (request, reply) => {
      const q = request.query as Record<string, string>;
      const tenantId = (request as { tenantId?: string }).tenantId ?? q.tenant_id;
      if (!tenantId || !q.guest_id) {
        return reply.status(400).send({ error: "tenant_id and guest_id are required" });
      }

      const result = await listGuestRedemptions({
        tenantId,
        guestId: q.guest_id,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      });

      return reply.send(result);
    },
  );
};
