import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getArrivalsReport,
  getDeparturesReport,
  getInHouseReport,
  getOccupancyReport,
  getPerformanceReport,
  getRevenueKpiReport,
  GuestListReportSchema,
  OccupancyReportSchema,
  PerformanceReportSchema,
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
      const { tenant_id, property_id, start_date, end_date } =
        DateRangeReportQuerySchema.parse(request.query);

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
      const { tenant_id, property_id, start_date, end_date } =
        DateRangeReportQuerySchema.parse(request.query);

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
      const { tenant_id, property_id, limit, offset } =
        InHouseQuerySchema.parse(request.query);

      return getInHouseReport({
        tenantId: tenant_id,
        propertyId: property_id,
        limit,
        offset,
      });
    },
  );
};
