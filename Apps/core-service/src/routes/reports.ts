import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  DemandForecastReportSchema,
  GuestListReportSchema,
  getArrivalsReport,
  getAuditTrailReport,
  getDemandForecastReport,
  getDeparturesReport,
  getFlashReport,
  getGuestStatisticsReport,
  getHousekeepingProductivityReport,
  getInHouseReport,
  getMaintenanceSlaReport,
  getMarketSegmentProductionReport,
  getNoShowReport,
  getOccupancyReport,
  getPaceReport,
  getPerformanceReport,
  getRevenueForecastReport,
  getRevenueKpiReport,
  getVipArrivalsReport,
  OccupancyReportSchema,
  PaceReportSchema,
  PerformanceReportSchema,
  RevenueForecastReportSchema,
  RevenueKpiReportSchema,
} from "../services/report-service.js";

const PerformanceReportQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  start_date: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "start_date must be a valid ISO date string",
    }),
  end_date: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "end_date must be a valid ISO date string",
    }),
});

/** Shared query schema for date-ranged reports (occupancy, revenue-kpis, arrivals, departures). */
const DateRangeReportQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  start_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "start_date must be a valid ISO date string",
  }),
  end_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "end_date must be a valid ISO date string",
  }),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** In-house doesn't need date range. */
const InHouseQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

type PerformanceReportQuery = z.infer<typeof PerformanceReportQuerySchema>;
const PerformanceReportQueryJsonSchema = schemaFromZod(
  PerformanceReportQuerySchema,
  "PerformanceReportQuery",
);
const PerformanceReportResponseJsonSchema = schemaFromZod(
  PerformanceReportSchema,
  "PerformanceReportResponse",
);

const REPORTS_TAG = "Reports";

type DateRangeReportQuery = z.infer<typeof DateRangeReportQuerySchema>;
type InHouseQuery = z.infer<typeof InHouseQuerySchema>;

// JSON schemas for OpenAPI documentation
const DateRangeQueryJsonSchema = schemaFromZod(DateRangeReportQuerySchema, "DateRangeReportQuery");
const InHouseQueryJsonSchema = schemaFromZod(InHouseQuerySchema, "InHouseQuery");
const OccupancyReportJsonSchema = schemaFromZod(OccupancyReportSchema, "OccupancyReportResponse");
const RevenueKpiJsonSchema = schemaFromZod(RevenueKpiReportSchema, "RevenueKpiReportResponse");
const GuestListJsonSchema = schemaFromZod(GuestListReportSchema, "GuestListReportResponse");
const DemandForecastJsonSchema = schemaFromZod(
  DemandForecastReportSchema,
  "DemandForecastReportResponse",
);
const PaceReportJsonSchema = schemaFromZod(PaceReportSchema, "PaceReportResponse");
const RevenueForecastJsonSchema = schemaFromZod(
  RevenueForecastReportSchema,
  "RevenueForecastReportResponse",
);

export const registerReportRoutes = (app: FastifyInstance): void => {
  // ─── Performance Report ────────────────────────────────────────────────────
  app.get<{ Querystring: PerformanceReportQuery }>(
    "/v1/reports/performance",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PerformanceReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Generate a performance report",
        querystring: PerformanceReportQueryJsonSchema,
        response: {
          200: PerformanceReportResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = PerformanceReportQuerySchema.parse(
        request.query,
      );

      const report = await getPerformanceReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });

      return PerformanceReportSchema.parse(report);
    },
  );

  // ─── Occupancy Report ──────────────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/occupancy",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Occupancy report (rooms sold, available, occupancy %)",
        querystring: DateRangeQueryJsonSchema,
        response: { 200: OccupancyReportJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeReportQuerySchema.parse(
        request.query,
      );

      return getOccupancyReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ─── Revenue KPI Report ────────────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/revenue-kpis",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Revenue KPIs (ADR, RevPAR, TRevPAR, occupancy %)",
        querystring: DateRangeQueryJsonSchema,
        response: { 200: RevenueKpiJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeReportQuerySchema.parse(
        request.query,
      );

      return getRevenueKpiReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ─── Arrivals List ─────────────────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/arrivals",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Arrivals list for a date range",
        querystring: DateRangeQueryJsonSchema,
        response: { 200: GuestListJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, limit, offset } =
        DateRangeReportQuerySchema.parse(request.query);

      return getArrivalsReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        limit,
        offset,
      });
    },
  );

  // ─── Departures List ───────────────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/departures",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Departures list for a date range",
        querystring: DateRangeQueryJsonSchema,
        response: { 200: GuestListJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, limit, offset } =
        DateRangeReportQuerySchema.parse(request.query);

      return getDeparturesReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        limit,
        offset,
      });
    },
  );

  // ─── In-House Guest List ───────────────────────────────────────────────────
  app.get<{ Querystring: InHouseQuery }>(
    "/v1/reports/in-house",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as InHouseQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Currently in-house guests (checked-in)",
        querystring: InHouseQueryJsonSchema,
        response: { 200: GuestListJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, limit, offset } = InHouseQuerySchema.parse(request.query);

      return getInHouseReport({
        tenantId: tenant_id,
        propertyId: property_id,
        limit,
        offset,
      });
    },
  );

  // ─── S13: Demand Forecast Report ──────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/demand-forecast",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Demand forecast (occupancy, ADR, RevPAR projections)",
        querystring: DateRangeQueryJsonSchema,
        response: { 200: DemandForecastJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeReportQuerySchema.parse(
        request.query,
      );

      return getDemandForecastReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ─── S13: Booking Pace Report ─────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/pace",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Booking pace report (pickup, vs last year, booking trends)",
        querystring: DateRangeQueryJsonSchema,
        response: { 200: PaceReportJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeReportQuerySchema.parse(
        request.query,
      );

      return getPaceReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ─── S13: Revenue Forecast Report ─────────────────────────────────────────
  const RevenueForecastQuerySchema = DateRangeReportQuerySchema.extend({
    scenario: z.string().optional(),
  });
  type RevenueForecastQuery = z.infer<typeof RevenueForecastQuerySchema>;
  const RevenueForecastQueryJsonSchema = schemaFromZod(
    RevenueForecastQuerySchema,
    "RevenueForecastQuery",
  );

  app.get<{ Querystring: RevenueForecastQuery }>(
    "/v1/reports/revenue-forecast",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RevenueForecastQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Revenue forecast (scenario-based projections with confidence intervals)",
        querystring: RevenueForecastQueryJsonSchema,
        response: { 200: RevenueForecastJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, scenario, limit, offset } =
        RevenueForecastQuerySchema.parse(request.query);

      return getRevenueForecastReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        scenario,
        limit,
        offset,
      });
    },
  );

  // ─── Manager's Flash Report ─────────────────────────────────────────────────
  const FlashReportQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    business_date: z
      .string()
      .optional()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
        message: "business_date must be a valid ISO date string",
      }),
  });
  type FlashReportQuery = z.infer<typeof FlashReportQuerySchema>;
  const FlashReportQueryJsonSchema = schemaFromZod(FlashReportQuerySchema, "FlashReportQuery");

  app.get<{ Querystring: FlashReportQuery }>(
    "/v1/reports/flash",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as FlashReportQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Manager's flash report — real-time operational snapshot",
        description:
          "Returns rooms (sold, available, OOO, OOS, occupancy), revenue (ADR, RevPAR), " +
          "arrivals/departures, in-house, housekeeping, and maintenance KPIs for the business date.",
        querystring: FlashReportQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, business_date } = FlashReportQuerySchema.parse(request.query);

      return getFlashReport({
        tenantId: tenant_id,
        propertyId: property_id,
        businessDate: business_date,
      });
    },
  );

  // ─── No-Show Report ─────────────────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/no-shows",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "No-show report — reservations marked as no-show",
        querystring: DateRangeQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, limit, offset } =
        DateRangeReportQuerySchema.parse(request.query);
      return getNoShowReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        limit,
        offset,
      });
    },
  );

  // ─── VIP Arrivals Report ────────────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/vip-arrivals",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "VIP arrivals — expected VIP guests for a date range",
        querystring: DateRangeQueryJsonSchema,
        response: { 200: GuestListJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, limit, offset } =
        DateRangeReportQuerySchema.parse(request.query);
      return getVipArrivalsReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        limit,
        offset,
      });
    },
  );

  // ─── Guest Statistics Report ────────────────────────────────────────────────
  const GuestStatsQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
  });
  type GuestStatsQuery = z.infer<typeof GuestStatsQuerySchema>;
  const GuestStatsQueryJsonSchema = schemaFromZod(GuestStatsQuerySchema, "GuestStatsQuery");

  app.get<{ Querystring: GuestStatsQuery }>(
    "/v1/reports/guest-statistics",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GuestStatsQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Guest statistics — demographics, nationality, loyalty tier breakdown",
        querystring: GuestStatsQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id } = GuestStatsQuerySchema.parse(request.query);
      return getGuestStatisticsReport({ tenantId: tenant_id, propertyId: property_id });
    },
  );

  // ─── Market Segment Production Report ───────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/market-segment-production",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Market segment production — room nights and revenue by segment",
        querystring: DateRangeQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeReportQuerySchema.parse(
        request.query,
      );
      return getMarketSegmentProductionReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ─── Housekeeping Productivity Report ───────────────────────────────────────
  const HkProductivityQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  type HkProductivityQuery = z.infer<typeof HkProductivityQuerySchema>;
  const HkProductivityQueryJsonSchema = schemaFromZod(
    HkProductivityQuerySchema,
    "HkProductivityQuery",
  );

  app.get<{ Querystring: HkProductivityQuery }>(
    "/v1/reports/housekeeping-productivity",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as HkProductivityQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Housekeeping productivity — task completion and attendant performance",
        querystring: HkProductivityQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, business_date } = HkProductivityQuerySchema.parse(
        request.query,
      );
      return getHousekeepingProductivityReport({
        tenantId: tenant_id,
        propertyId: property_id,
        businessDate: business_date,
      });
    },
  );

  // ─── Maintenance SLA Report ─────────────────────────────────────────────────
  app.get<{ Querystring: DateRangeReportQuery }>(
    "/v1/reports/maintenance-sla",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeReportQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Maintenance SLA — request resolution, response times, and priority breakdown",
        querystring: DateRangeQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeReportQuerySchema.parse(
        request.query,
      );
      return getMaintenanceSlaReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ─── Audit Trail Report ─────────────────────────────────────────────────────
  const AuditTrailQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    command_name: z.string().optional(),
    initiated_by: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  });
  type AuditTrailQuery = z.infer<typeof AuditTrailQuerySchema>;
  const AuditTrailQueryJsonSchema = schemaFromZod(AuditTrailQuerySchema, "AuditTrailQuery");

  app.get<{ Querystring: AuditTrailQuery }>(
    "/v1/reports/audit-trail",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as AuditTrailQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Audit trail — command history log with filters",
        querystring: AuditTrailQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, start_date, end_date, command_name, initiated_by, limit, offset } =
        AuditTrailQuerySchema.parse(request.query);
      return getAuditTrailReport({
        tenantId: tenant_id,
        startDate: start_date,
        endDate: end_date,
        commandName: command_name,
        initiatedBy: initiated_by,
        limit,
        offset,
      });
    },
  );
};
