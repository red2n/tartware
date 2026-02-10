import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

export const registerOperationsRoutes = (app: FastifyInstance): void => {
  const OPERATIONS_TAG = "Operations";

  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  // Cashier Sessions
  app.get(
    "/v1/cashier-sessions",
    {
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List cashier sessions.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/cashier-sessions/*",
    {
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
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List shift handovers.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/shift-handovers/*",
    {
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy shift handover operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Lost and Found
  app.get(
    "/v1/lost-and-found",
    {
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List lost and found items.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/lost-and-found/*",
    {
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy lost and found operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Banquet Event Orders
  app.get(
    "/v1/banquet-orders",
    {
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List banquet event orders (BEOs).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/banquet-orders/*",
    {
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
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List guest feedback and reviews.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/guest-feedback/*",
    {
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
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "List police/incident reports.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/police-reports/*",
    {
      schema: buildRouteSchema({
        tag: OPERATIONS_TAG,
        summary: "Proxy police report operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );
};
