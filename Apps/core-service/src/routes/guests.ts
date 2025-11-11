import { GuestWithStatsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listGuests } from "../services/guest-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const GuestListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid(),
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
  app.get<{ Querystring: GuestListQuery }>(
    "/v1/guests",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GuestListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
    },
    async (request) => {
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
    },
  );
};
