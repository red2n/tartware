import { buildRouteSchema } from "@tartware/openapi";
import {
  type CompetitorRateListQuery,
  CompetitorRateListQuerySchema,
  type DemandCalendarListQuery,
  DemandCalendarListQuerySchema,
  type PricingRuleListQuery,
  PricingRuleListQuerySchema,
  type RecommendationListQuery,
  RecommendationListQuerySchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
  getPricingRuleById,
  listCompetitorRates,
  listDemandCalendar,
  listPricingRules,
  listRateRecommendations,
} from "../services/pricing-service.js";

const PRICING_TAG = "Dynamic Pricing";

const pricingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{ Querystring: PricingRuleListQuery }>(
    "/v1/revenue/pricing-rules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PricingRuleListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: PRICING_TAG,
        summary: "List dynamic pricing rules",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, rule_type, is_active, limit, offset } =
        PricingRuleListQuerySchema.parse(request.query);

      return listPricingRules({
        tenantId: tenant_id,
        propertyId: property_id,
        ruleType: rule_type,
        isActive: is_active,
        limit,
        offset,
      });
    },
  );

  app.get<{ Params: { ruleId: string }; Querystring: { tenant_id: string } }>(
    "/v1/revenue/pricing-rules/:ruleId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: PRICING_TAG,
        summary: "Get pricing rule by ID",
      }),
    },
    async (request, reply) => {
      const { ruleId } = request.params;
      const { tenant_id } = request.query;

      const rule = await getPricingRuleById(ruleId, tenant_id);
      if (!rule) {
        reply.notFound("PRICING_RULE_NOT_FOUND");
        return;
      }
      return rule;
    },
  );

  app.get<{ Querystring: RecommendationListQuery }>(
    "/v1/revenue/rate-recommendations",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RecommendationListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: PRICING_TAG,
        summary: "List rate recommendations",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, status, recommendation_date, limit, offset } =
        RecommendationListQuerySchema.parse(request.query);

      return listRateRecommendations({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        recommendationDate: recommendation_date,
        limit,
        offset,
      });
    },
  );

  app.get<{ Querystring: CompetitorRateListQuery }>(
    "/v1/revenue/competitor-rates",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CompetitorRateListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: PRICING_TAG,
        summary: "List competitor rate intelligence",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, rate_date, limit, offset } =
        CompetitorRateListQuerySchema.parse(request.query);

      return listCompetitorRates({
        tenantId: tenant_id,
        propertyId: property_id,
        rateDate: rate_date,
        limit,
        offset,
      });
    },
  );

  app.get<{ Querystring: DemandCalendarListQuery }>(
    "/v1/revenue/demand-calendar",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DemandCalendarListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: PRICING_TAG,
        summary: "List demand calendar entries",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, date_from, date_to, limit, offset } =
        DemandCalendarListQuerySchema.parse(request.query);

      return listDemandCalendar({
        tenantId: tenant_id,
        propertyId: property_id,
        dateFrom: date_from,
        dateTo: date_to,
        limit,
        offset,
      });
    },
  );
};

export default pricingRoutes;
