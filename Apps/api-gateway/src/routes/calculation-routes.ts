/**
 * Calculation service proxy routes.
 *
 * Forwards all `/v1/calculations/*` requests to the calculation
 * service which provides rate computation, tax calculation,
 * folio balance, and financial engine endpoints.
 *
 * @module calculation-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { CALCULATION_PROXY_TAG } from "./schemas.js";

/** Register calculation service proxy routes on the gateway. */
export const registerCalculationRoutes = (app: FastifyInstance): void => {
  const proxyCalculation = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.calculationServiceUrl);

  app.all(
    "/v1/calculations/*",
    {
      schema: buildRouteSchema({
        tag: CALCULATION_PROXY_TAG,
        summary: "Proxy calculation service requests.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCalculation,
  );
};
