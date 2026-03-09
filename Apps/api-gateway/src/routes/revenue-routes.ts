/**
 * Revenue service proxy routes.
 *
 * Forwards pricing-rules and general revenue management requests
 * to the revenue service for dynamic pricing, yield management,
 * and rate strategy endpoints.
 *
 * @module revenue-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { REVENUE_PROXY_TAG } from "./schemas.js";

/** Register revenue service proxy routes on the gateway. */
export const registerRevenueRoutes = (app: FastifyInstance): void => {
  const proxyRevenue = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.revenueServiceUrl);

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "VIEWER",
    requiredModules: "revenue-management",
  });

  app.get(
    "/v1/revenue/pricing-rules",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REVENUE_PROXY_TAG,
        summary: "Proxy pricing rules to the revenue service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyRevenue,
  );

  app.all(
    "/v1/revenue/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: REVENUE_PROXY_TAG,
        summary: "Proxy revenue service requests.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyRevenue,
  );
};
