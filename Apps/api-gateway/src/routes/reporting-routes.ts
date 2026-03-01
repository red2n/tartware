/**
 * Reporting proxy routes.
 *
 * Proxies all report endpoints to the core service. Includes
 * front-desk reports (arrivals, departures, in-house, no-show),
 * revenue reports (revenue summary, daily revenue), occupancy
 * and forecast reports, manager flash and STR metrics, housekeeping
 * status, and night audit summaries.
 *
 * All endpoints require `MANAGER` role and the `core` module.
 *
 * @module reporting-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { paginationQuerySchema, REPORTING_TAG } from "./schemas.js";

/** Register reporting proxy routes on the gateway. */
export const registerReportingRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  // ─── Front Desk Reports ──────────────────────────────────────

  app.get(
    "/v1/reports/arrivals",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Expected arrivals report for a business date.",
        querystring: paginationQuerySchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/reports/departures",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Expected departures report for a business date.",
        querystring: paginationQuerySchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/reports/in-house",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Currently in-house guests report.",
        querystring: paginationQuerySchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/reports/no-show",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "No-show reservations report for a business date.",
        querystring: paginationQuerySchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // ─── Revenue Reports ──────────────────────────────────────

  app.get(
    "/v1/reports/revenue-summary",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Revenue summary (room, F&B, other) for a date range.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/reports/daily-revenue",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Daily revenue breakdown (ADR, RevPAR, total revenue).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // ─── Occupancy & Forecast ──────────────────────────────────

  app.get(
    "/v1/reports/occupancy",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Occupancy statistics for a date range.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/reports/forecast",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Forward-looking occupancy and revenue forecast.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // ─── Manager / STR Reports ──────────────────────────────────

  app.get(
    "/v1/reports/manager-flash",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Manager flash report (key daily metrics snapshot).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/reports/str-metrics",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "STR-compatible performance metrics (ADR, RevPAR, occupancy).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // ─── Housekeeping Reports ──────────────────────────────────

  app.get(
    "/v1/reports/housekeeping-status",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Room housekeeping status matrix.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // ─── Night Audit Reports ──────────────────────────────────

  app.get(
    "/v1/reports/night-audit-summary",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Night audit summary report (posting totals, adjustments, balance).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // ─── Catch-all for additional report endpoints ────────────

  app.get(
    "/v1/reports/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Proxy additional report requests to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );
};
