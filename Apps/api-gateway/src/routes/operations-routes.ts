/**
 * Front-desk and back-office operations proxy routes.
 *
 * Proxies CRUD operations for operational entities — cashier sessions,
 * shift handovers, lost-and-found items, banquet event orders, guest
 * feedback, police/incident reports, and compliance breach incidents —
 * to the core service.
 *
 * @module operations-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { OPERATIONS_TAG } from "./schemas.js";

/** Register front-desk operations proxy routes on the gateway. */
export const registerOperationsRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "STAFF",
    requiredModules: "core",
  });

  /**
   * Reads here carry `tenant_id` in the query; writes carry it in the body. A
   * query-only resolver returns undefined for a write, and `withTenantScope`
   * rejects a request it cannot scope — so every body-shaped write through these
   * proxies was refused before reaching core-service. Checking both is what makes
   * one registration serve a domain's reads and writes.
   * See ui-gaps/02-police-reports.md.
   */
  const tenantScopeFromQueryOrBody = app.withTenantScope({
    resolveTenantId: (request) =>
      (request.query as { tenant_id?: string })?.tenant_id ??
      (request.body as { tenant_id?: string } | undefined)?.tenant_id,
    minRole: "STAFF",
    requiredModules: "core",
  });

  // Cashier Sessions
  app.get(
    "/v1/cashier-sessions",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List cashier sessions.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/cashier-sessions/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy cashier session operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Shift Handovers
  app.get(
    "/v1/shift-handovers",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List shift handovers.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Opening a handover POSTs to the bare path, which `/v1/shift-handovers/*`
  // does not match. See ui-gaps/08-shift-handovers.md.
  app.post(
    "/v1/shift-handovers",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Open a shift handover.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/shift-handovers/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy shift handover operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Lost and Found is owned by housekeeping-service — see housekeeping-routes.ts.
  // It was registered here proxying to core-service, whose copy was read-only, so
  // register / update / claim / return all 404ed downstream. See ui-gaps/07-lost-and-found.md.

  // Banquet Event Orders
  app.get(
    "/v1/banquet-orders",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List banquet event orders (BEOs).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/banquet-orders/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy banquet order operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Guest Feedback
  app.get(
    "/v1/guest-feedback",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List guest feedback and reviews.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Logging feedback POSTs to the bare path, which `/v1/guest-feedback/*` does
  // not match, and the body carries tenant_id — the same trap as police-report
  // and incident filing. See ui-gaps/09-guest-feedback.md.
  app.post(
    "/v1/guest-feedback",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Log guest feedback.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/guest-feedback/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy guest feedback operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Police Reports
  app.get(
    "/v1/police-reports",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List police/incident reports.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  /**
   * Filing a report POSTs to the bare path, and `/v1/police-reports/*` does not
   * match it — Fastify's wildcard needs at least one more segment. Without this
   * registration every `POST /v1/police-reports` 404'd at the gateway while
   * core-service had a working handler. Tenant comes from the body on writes.
   * See ui-gaps/02-police-reports.md.
   */
  app.post(
    "/v1/police-reports",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "File a police report.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/police-reports/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy police report operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Compliance / Breach Incidents
  app.all(
    "/v1/compliance/breach-incidents",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List or report data breach incidents.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/compliance/breach-incidents/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy breach incident operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );
};
