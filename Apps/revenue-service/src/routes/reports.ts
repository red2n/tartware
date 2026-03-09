import { buildRouteSchema } from "@tartware/openapi";
import {
  type BookingPaceQuery,
  BookingPaceQuerySchema,
  type BudgetVarianceQuery,
  BudgetVarianceQuerySchema,
  type ChannelProfitabilityQuery,
  ChannelProfitabilityQuerySchema,
  type CompsetIndicesQuery,
  CompsetIndicesQuerySchema,
  type ForecastAccuracyQuery,
  ForecastAccuracyQuerySchema,
  type ForecastListQuery,
  ForecastListQuerySchema,
  type GoalListQuery,
  GoalListQuerySchema,
  type KpiQuery,
  KpiQuerySchema,
  type ManagersDailyReportQuery,
  ManagersDailyReportQuerySchema,
  type SegmentAnalysisQuery,
  SegmentAnalysisQuerySchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { getBookingPaceReport } from "../services/booking-pace-service.js";
import {
  getBudgetVarianceReport,
  getManagersDailyReport,
} from "../services/budget-report-service.js";
import { getChannelProfitability } from "../services/channel-profitability-service.js";
import { getForecastAccuracyReport } from "../services/forecast-accuracy-service.js";
import {
  getCompsetIndices,
  getDisplacementAnalysis,
  getRevenueKpis,
  listRevenueForecasts,
  listRevenueGoals,
} from "../services/report-service.js";
import { getSegmentAnalysis } from "../services/segment-analysis-service.js";

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

  app.get(
    "/v1/revenue/displacement-analysis",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Displacement analysis — group vs transient revenue trade-off",
      }),
    },
    async (request) => {
      const q = request.query as {
        tenant_id: string;
        property_id: string;
        start_date: string;
        end_date: string;
        limit?: string;
        offset?: string;
      };

      return getDisplacementAnalysis({
        tenantId: q.tenant_id,
        propertyId: q.property_id,
        startDate: q.start_date,
        endDate: q.end_date,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      });
    },
  );

  app.get<{ Querystring: BudgetVarianceQuery }>(
    "/v1/revenue/budget-variance",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BudgetVarianceQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Budget vs actual variance report by department, segment, and goal type",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, department, goal_type, limit, offset } =
        BudgetVarianceQuerySchema.parse(request.query);

      return getBudgetVarianceReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        department,
        goalType: goal_type,
        limit,
        offset,
      });
    },
  );

  app.get<{ Querystring: ManagersDailyReportQuery }>(
    "/v1/revenue/managers-report",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ManagersDailyReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary:
          "Manager's Daily Report — occupancy, revenue, rate metrics, segment mix, budget, forecast",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, business_date } = ManagersDailyReportQuerySchema.parse(
        request.query,
      );

      return getManagersDailyReport(property_id, tenant_id, business_date);
    },
  );

  // ── Booking Pace Report (R11) ─────────────────────────

  app.get<{ Querystring: BookingPaceQuery }>(
    "/v1/revenue/booking-pace",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BookingPaceQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "revenue-management",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary:
          "Booking pace report — OTB rooms/revenue vs same-time last year for each future date",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = BookingPaceQuerySchema.parse(
        request.query,
      );

      return getBookingPaceReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ── Forecast Accuracy Report (R13) ────────────────────

  app.get<{ Querystring: ForecastAccuracyQuery }>(
    "/v1/revenue/forecast-accuracy",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ForecastAccuracyQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "revenue-management",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Forecast accuracy — MAPE, bias, and per-date forecast vs actual comparison",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, forecast_scenario } =
        ForecastAccuracyQuerySchema.parse(request.query);

      return getForecastAccuracyReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        forecastScenario: forecast_scenario,
      });
    },
  );

  // ── Segment Performance Analytics (R17) ───────────────

  app.get<{ Querystring: SegmentAnalysisQuery }>(
    "/v1/revenue/segment-analysis",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as SegmentAnalysisQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "revenue-management",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary:
          "Segment performance — revenue, ADR, room nights by market segment with YoY comparison",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, compare_ly } =
        SegmentAnalysisQuerySchema.parse(request.query);

      return getSegmentAnalysis({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        compareLy: compare_ly !== "false",
      });
    },
  );

  // ── Channel Profitability Analysis (R18) ──────────────

  app.get<{ Querystring: ChannelProfitabilityQuery }>(
    "/v1/revenue/channel-profitability",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ChannelProfitabilityQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "revenue-management",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Channel profitability — gross/net revenue, commission by distribution channel",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } =
        ChannelProfitabilityQuerySchema.parse(request.query);

      return getChannelProfitability({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );
};

export default reportRoutes;
