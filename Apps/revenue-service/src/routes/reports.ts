import { buildRouteSchema } from "@tartware/openapi";
import {
  type CompsetIndicesQuery,
  CompsetIndicesQuerySchema,
  type ForecastListQuery,
  ForecastListQuerySchema,
  type GoalListQuery,
  GoalListQuerySchema,
  type KpiQuery,
  KpiQuerySchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
  getCompsetIndices,
  getRevenueKpis,
  listRevenueForecasts,
  listRevenueGoals,
} from "../services/report-service.js";

const REPORTS_TAG = "Revenue Reports";

const reportRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{ Querystring: ForecastListQuery }>(
    "/v1/revenue/forecasts",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ForecastListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "List revenue forecasts",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, forecast_period, scenario_type, limit, offset } =
        ForecastListQuerySchema.parse(request.query);

      return listRevenueForecasts({
        tenantId: tenant_id,
        propertyId: property_id,
        forecastPeriod: forecast_period,
        scenarioType: scenario_type,
        limit,
        offset,
      });
    },
  );

  app.get<{ Querystring: GoalListQuery }>(
    "/v1/revenue/goals",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GoalListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "List revenue goals with budget vs actual tracking",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, goal_type, status, limit, offset } =
        GoalListQuerySchema.parse(request.query);

      return listRevenueGoals({
        tenantId: tenant_id,
        propertyId: property_id,
        goalType: goal_type,
        status,
        limit,
        offset,
      });
    },
  );

  app.get<{ Querystring: KpiQuery }>(
    "/v1/revenue/kpis",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as KpiQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Get revenue KPIs (occupancy, ADR, RevPAR) for a business date",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, business_date } = KpiQuerySchema.parse(request.query);

      return getRevenueKpis(property_id, tenant_id, business_date);
    },
  );

  app.get<{ Querystring: CompsetIndicesQuery }>(
    "/v1/revenue/compset-indices",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CompsetIndicesQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Get STR-style competitive set indices (ARI, Occupancy Index, RGI)",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, business_date } = CompsetIndicesQuerySchema.parse(
        request.query,
      );

      return getCompsetIndices(property_id, tenant_id, business_date);
    },
  );
};

export default reportRoutes;
