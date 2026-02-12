import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

export const registerRevenueRoutes = (app: FastifyInstance): void => {
  const REVENUE_PROXY_TAG = "Revenue Proxy";

  const proxyRevenue = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.revenueServiceUrl);

  app.get(
    "/v1/revenue/pricing-rules",
    {
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
      schema: buildRouteSchema({
        tag: REVENUE_PROXY_TAG,
        summary: "Proxy revenue service requests.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyRevenue,
  );
};
