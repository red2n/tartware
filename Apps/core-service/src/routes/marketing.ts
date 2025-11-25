import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getCampaignSummaries,
  getChannelPerformance,
  getLeadSources,
} from "../services/marketing-service.js";

const MarketingQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).default(8),
});

type MarketingQuery = z.infer<typeof MarketingQuerySchema>;

const ChannelPerformanceSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string().nullable(),
    average_daily_rate: z.number().nullable(),
    pickup_change_percent: z.number().nullable(),
    next_sync_eta_minutes: z.number().int().nullable(),
    last_sync_at: z.string().nullable(),
    status: z.enum(["synced", "attention"]),
    total_bookings: z.number().int(),
    total_revenue: z.number(),
  }),
);

const CampaignSummarySchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    audience: z.string().nullable(),
    status: z.string(),
    click_through_rate: z.number().nullable(),
    budget_amount: z.number().nullable(),
    actual_spend: z.number().nullable(),
    budget_currency: z.string().nullable(),
    budget_utilization_percent: z.number().nullable(),
  }),
);

const LeadSourceSchema = z.array(
  z.object({
    source: z.string(),
    leads: z.number().int(),
    conversion_rate: z.number().nullable(),
    average_booking_value: z.number().nullable(),
    quality: z.enum(["great", "ok", "watch"]),
  }),
);

export const registerMarketingRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: MarketingQuery }>(
    "/v1/marketing/channels",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MarketingQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "marketing-channel",
      }),
    },
    async (request) => {
      const query = MarketingQuerySchema.parse(request.query);
      const channels = await getChannelPerformance({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
        limit: query.limit,
      });
      return ChannelPerformanceSchema.parse(channels);
    },
  );

  app.get<{ Querystring: MarketingQuery }>(
    "/v1/marketing/campaigns",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MarketingQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "marketing-channel",
      }),
    },
    async (request) => {
      const query = MarketingQuerySchema.parse(request.query);
      const campaigns = await getCampaignSummaries({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
        limit: query.limit,
      });
      return CampaignSummarySchema.parse(campaigns);
    },
  );

  app.get<{ Querystring: MarketingQuery }>(
    "/v1/marketing/lead-sources",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MarketingQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "marketing-channel",
      }),
    },
    async (request) => {
      const query = MarketingQuerySchema.parse(request.query);
      const leads = await getLeadSources({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
        limit: query.limit,
      });
      return LeadSourceSchema.parse(leads);
    },
  );
};
