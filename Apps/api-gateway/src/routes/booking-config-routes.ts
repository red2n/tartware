import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { BOOKING_CONFIG_TAG } from "./schemas.js";

export const registerBookingConfigRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "STAFF",
    requiredModules: "core",
  });

  app.get(
    "/v1/allotments",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List allotments (room blocks for groups/events).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/allotments/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy allotment operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/booking-sources",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List booking sources (OTAs, GDS, direct channels).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/booking-sources/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy booking source operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/market-segments",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List market segments for guest categorization.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/market-segments/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy market segment operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/channel-mappings",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List OTA/GDS channel mappings.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/channel-mappings/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy channel mapping operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/companies",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List corporate accounts and business partners.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/companies/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy company operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/meeting-rooms",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List conference rooms and event spaces.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/meeting-rooms/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy meeting room operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/event-bookings",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List event bookings (meetings, conferences, banquets).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/event-bookings/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy event booking operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/waitlist",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List waitlist entries for room availability.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/waitlist/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy waitlist operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Group Bookings - room blocks for corporate/group reservations
  app.get(
    "/v1/group-bookings",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List group bookings (corporate blocks, tours, events).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/group-bookings/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy group booking operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Promotional Codes - discounts and marketing campaigns
  app.get(
    "/v1/promo-codes",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List promotional codes and discount campaigns.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/promo-codes/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy promotional code operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Night Audit - EOD processing and business date management
  app.get(
    "/v1/night-audit/status",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Get current business date status for a property.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/night-audit/history",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List night audit run history.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/night-audit/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy night audit operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // OTA/Channel Connections - third-party booking integrations
  app.get(
    "/v1/ota-connections",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List OTA and channel manager connections.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/ota-connections/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy OTA connection operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Metasearch Configurations - CPC/CPA bid management
  app.get(
    "/v1/metasearch-configs",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List metasearch platform configurations.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/metasearch-configs/performance",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Get metasearch click performance stats.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/metasearch-configs/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy metasearch configuration operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );
};
