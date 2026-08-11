/**
 * Reporting proxy routes.
 *
 * Proxies report endpoints to the core service. Includes front-desk
 * reports (arrivals, departures, in-house, no-shows), occupancy and
 * demand forecast, the manager flash report, and housekeeping
 * productivity.
 *
 * Every path declared here must be registered by core-service in
 * `src/routes/reports.ts` — `tests/proxy-route-conformance.test.ts`
 * enforces that, because a documented proxy with no downstream handler
 * returns 404 while advertising a capability the system lacks. Reports
 * core-service adds later are reachable through the catch-all below
 * without a change here; declare one explicitly only to document it.
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
    "/v1/reports/no-shows",
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
    "/v1/reports/demand-forecast",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Forward-looking occupancy and demand forecast.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // ─── Manager Reports ────────────────────────────────────────

  app.get(
    "/v1/reports/flash",
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

  // ─── Housekeeping Reports ──────────────────────────────────

  app.get(
    "/v1/reports/housekeeping-productivity",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REPORTING_TAG,
        summary: "Housekeeping productivity report (rooms cleaned, minutes per room).",
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
