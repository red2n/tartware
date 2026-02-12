import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

export const registerSelfServiceRoutes = (app: FastifyInstance): void => {
  const SELF_SERVICE_PROXY_TAG = "Self-Service Proxy";

  const proxySelfService = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.guestExperienceServiceUrl);

  // ─── Check-In Routes ──────────────────────────────────────

  app.post(
    "/v1/self-service/check-in/start",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Start mobile check-in for a reservation.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  app.post(
    "/v1/self-service/check-in/:checkinId/complete",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Complete a mobile check-in.",
        body: jsonObjectSchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  app.get(
    "/v1/self-service/check-in/:checkinId",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Get mobile check-in status.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  // ─── Registration Card Routes ──────────────────────────────

  app.get(
    "/v1/self-service/registration-card/:reservationId",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Get registration card for a reservation.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  app.get(
    "/v1/self-service/registration-card/:reservationId/html",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Get registration card as HTML.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  // ─── Key Routes ──────────────────────────────────────

  app.get(
    "/v1/self-service/keys/:reservationId",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Get active mobile keys for a reservation.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  // ─── Booking Routes ──────────────────────────────────

  app.get(
    "/v1/self-service/search",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Search available room types.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  app.post(
    "/v1/self-service/book",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Create a direct booking.",
        body: jsonObjectSchema,
        response: { 202: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  app.get(
    "/v1/self-service/booking/:confirmationCode",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Look up a booking by confirmation code.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );

  // ─── Catch-all ──────────────────────────────────

  app.all(
    "/v1/self-service/*",
    {
      schema: buildRouteSchema({
        tag: SELF_SERVICE_PROXY_TAG,
        summary: "Proxy self-service requests to the guest-experience service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxySelfService,
  );
};
