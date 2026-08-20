/**
 * Booking configuration proxy routes.
 *
 * Proxies CRUD operations for low-velocity booking configuration
 * entities — allotments, booking sources, market segments, channel
 * mappings, corporate accounts, meeting rooms, and event bookings —
 * to the core service.
 *
 * @module booking-config-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { forwardCommandWithTenant } from "./command-helpers.js";
import {
  allotmentListResponse,
  bookingSourceListResponse,
  channelMappingListResponse,
  marketSegmentListResponse,
} from "./response-schemas.js";
import { BOOKING_CONFIG_TAG, commandAcceptedSchema, reservationParamsSchema } from "./schemas.js";

/** Register booking configuration proxy routes on the gateway. */
export const registerBookingConfigRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const proxyBilling = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.billingServiceUrl);

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "STAFF",
    requiredModules: "core",
  });

  /**
   * Reads scope by query, writes by body. `withTenantScope` rejects any request it
   * cannot scope, so a query-only resolver refuses every body-shaped write before
   * it reaches core-service — the same defect fixed in operations-routes.ts.
   */
  const tenantScopeFromQueryOrBody = app.withTenantScope({
    resolveTenantId: (request) =>
      (request.query as { tenant_id?: string })?.tenant_id ??
      (request.body as { tenant_id?: string } | undefined)?.tenant_id,
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
        response: { 200: allotmentListResponse },
      }),
    },
    proxyCore,
  );

  /**
   * Creating an allotment POSTs to the bare path, which `/v1/allotments/*` does
   * not match — Fastify's wildcard needs one more segment. Every earlier slice
   * in this family shipped without this registration and 404ed at the gateway
   * with a working handler downstream; `wildcard-write-conformance.test.ts`
   * catches the other half.
   */
  app.post(
    "/v1/allotments",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Create an allotment (contracted room block).",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  /** `app.all`, not `app.get`: PUT /:id and POST /:id/status live under here. */
  app.all(
    "/v1/allotments/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
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
        response: { 200: bookingSourceListResponse },
      }),
    },
    proxyCore,
  );

  // Creating reference data POSTs to the bare path, which the wildcard does not
  // match, and the body carries tenant_id. See ui-gaps/14-channel-distribution.md.
  app.post(
    "/v1/booking-sources",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Create a booking source.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/booking-sources/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
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
        response: { 200: marketSegmentListResponse },
      }),
    },
    proxyCore,
  );

  app.post(
    "/v1/market-segments",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Create a market segment.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/market-segments/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
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
        response: { 200: channelMappingListResponse },
      }),
    },
    proxyCore,
  );

  app.get(
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

  /**
   * Creating a company POSTs to the bare path, which `/v1/companies/*` does not
   * match — Fastify's wildcard needs a further segment. Without this every
   * create would 404 at the gateway, exactly as police-report filing did.
   */
  app.post(
    "/v1/companies",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Create a company (corporate account, travel agency, OTA).",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/companies/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
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

  // Creating reference data POSTs to the bare path, which the wildcard does not
  // match, and the body carries tenant_id. See ui-gaps/13-sales-catering.md.
  app.post(
    "/v1/meeting-rooms",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Create a meeting room.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/meeting-rooms/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
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

  // Booking function space POSTs to the bare path, which the wildcard does not
  // match, and the body carries tenant_id. See ui-gaps/13-sales-catering.md.
  app.post(
    "/v1/event-bookings",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Create an event booking.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // `app.all`, not `app.get`: PUT /:eventId and POST /:eventId/status both land
  // here, and a GET-only wildcard silently swallows them.
  app.all(
    "/v1/event-bookings/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
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

  app.get(
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

  app.get(
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

  // Creating a code POSTs to the bare path, which `/v1/promo-codes/*` does not
  // match. See ui-gaps/16-booking-reference-data.md.
  app.post(
    "/v1/promo-codes",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Create a promotional code.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  /**
   * Query-or-body scoping, not query-only. `POST /v1/promo-codes/validate`
   * carries `tenant_id` in the body, so a query-only resolver refused every
   * validation attempt with TENANT_ID_REQUIRED before it reached core-service —
   * the redemption path this spec described as "already working" was refused at
   * the gateway. The write routes added below are body-shaped for the same reason.
   */
  app.all(
    "/v1/promo-codes/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy promotional code operations to core service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );

  // Night Audit - EOD processing and business date management → billing-service
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
    proxyBilling,
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
    proxyBilling,
  );

  // `app.all` forwards writes, so it needs the body resolver too — a query-only
  // wildcard refuses every body-shaped write at the edge. Both helpers are STAFF.
  app.all(
    "/v1/night-audit/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "Proxy night audit operations to billing service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyBilling,
  );

  /**
   * The real connections domain — credentials, endpoint, sync settings.
   * `/v1/ota-connections` below is a projection of `channel_mappings` despite the
   * name. See ui-gaps/14-channel-distribution.md.
   */
  app.get(
    "/v1/ota-configurations",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_CONFIG_TAG,
        summary: "List OTA configurations (credentials redacted).",
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

  app.get(
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

  /**
   * Channel operator actions.
   *
   * `integration.ota.sync_request`, `.rate_push`, `.content_sync` and
   * `integration.webhook.retry` have been implemented in
   * reservations-command-service all along, with no REST wrapper and no UI
   * dispatch — so a stale mapping or a failed push had no operator-facing
   * recovery and every failure became an engineering ticket. These wrappers add
   * no new backend logic; they make the existing handlers reachable.
   * See ui-gaps/14-channel-distribution.md.
   *
   * Module gating is left to the command catalog, which already requires
   * `marketing-channel` for all four — duplicating it here would mean two places
   * to keep in step.
   */
  const tenantWriteScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  const channelCommandRoute = (path: string, summary: string, commandName: string): void => {
    app.post(
      path,
      {
        preHandler: tenantWriteScopeFromParams,
        schema: buildRouteSchema({
          tag: BOOKING_CONFIG_TAG,
          summary,
          params: reservationParamsSchema,
          body: jsonObjectSchema,
          response: { 202: commandAcceptedSchema },
        }),
      },
      (request, reply) => forwardCommandWithTenant({ request, reply, commandName }),
    );
  };

  channelCommandRoute(
    "/v1/tenants/:tenantId/channels/sync",
    "Request a channel sync via the Command Center.",
    "integration.ota.sync_request",
  );
  channelCommandRoute(
    "/v1/tenants/:tenantId/channels/rate-push",
    "Push rates to a channel via the Command Center.",
    "integration.ota.rate_push",
  );
  channelCommandRoute(
    "/v1/tenants/:tenantId/channels/content-sync",
    "Push property and room content to a channel via the Command Center.",
    "integration.ota.content_sync",
  );
  channelCommandRoute(
    "/v1/tenants/:tenantId/channels/webhook-retry",
    "Retry a failed inbound webhook delivery via the Command Center.",
    "integration.webhook.retry",
  );

  /**
   * Mapping edits go through the command bus, not HTTP.
   *
   * `channel_mappings` is the one table behind both `/v1/channel-mappings` and
   * `/v1/ota-connections` — the latter is a projection of the same rows, not a
   * separate domain, so there is no `ota_connections` table to give CRUD to.
   * Editing a mapping fans out to OTA sync, which is COV-18's test for command
   * rather than HTTP, and `integration.mapping.update` already implements it —
   * it simply had no wrapper. See ui-gaps/14-channel-distribution.md.
   */
  channelCommandRoute(
    "/v1/tenants/:tenantId/channels/mapping-update",
    "Update a channel ↔ room-type mapping via the Command Center.",
    "integration.mapping.update",
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

  app.get(
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
