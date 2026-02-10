import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

export const registerBookingConfigRoutes = (app: FastifyInstance): void => {
  const BOOKING_CONFIG_TAG = "Booking Configuration";

  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  app.get(
    "/v1/allotments",
    {
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
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy OTA connection operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );
};
