import { GuestWithStatsSchema } from "@tartware/schemas/core/guests";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { listGuests } from "../services/guest-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const GuestListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid().optional(),
  email: z.string().min(3).max(255).optional(),
  phone: z.string().min(3).max(20).optional(),
  loyalty_tier: z.string().min(1).max(50).optional(),
  vip_status: z.coerce.boolean().optional(),
  is_blacklisted: z.coerce.boolean().optional(),
});

type GuestListQuery = z.infer<typeof GuestListQuerySchema>;

const GuestListResponseSchema = z.array(
  GuestWithStatsSchema.extend({
    version: z.string(),
  }),
);

export const registerGuestRoutes = (app: FastifyInstance): void => {
  app.get("/v1/guests", async (request: FastifyRequest<{ Querystring: GuestListQuery }>) => {
    const { limit, tenant_id, email, phone, loyalty_tier, vip_status, is_blacklisted } =
      GuestListQuerySchema.parse(request.query);

    const guests = await listGuests({
      limit,
      tenantId: tenant_id,
      email,
      phone,
      loyaltyTier: loyalty_tier,
      vipStatus: vip_status,
      isBlacklisted: is_blacklisted,
    });

    const response = sanitizeForJson(guests);
    return GuestListResponseSchema.parse(response);
  });
};
