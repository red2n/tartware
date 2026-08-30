/**
 * Room, room-type, rate, rate-calendar, and availability proxy routes,
 * plus room inventory command routes.
 *
 * Read endpoints (GET) proxy to the rooms service for room/type/rate
 * queries and ARI (availability, rates, inventory) lookups.
 * Write endpoints (POST) dispatch commands through the Command Center
 * for room blocking/releasing, status updates, and housekeeping
 * status changes.
 *
 * @module room-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import { COMMAND_AUTHORITY_FLOOR } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { cachedReadConfig, serviceTargets } from "../config.js";
import { createCachedRead } from "../utils/cached-read.js";
import { proxyRequest } from "../utils/proxy.js";

import { forwardCommandWithParamId, forwardRoomInventoryCommand } from "./command-helpers.js";
import {
  roomGridResponse,
  roomListResponse,
  roomTypeGridResponse,
  roomTypeListResponse,
} from "./response-schemas.js";
import {
  AVAILABILITY_TAG,
  CORE_PROXY_TAG,
  commandAcceptedSchema,
  paginationQuerySchema,
  ROOM_COMMAND_TAG,
  tenantRoomParamsSchema,
} from "./schemas.js";

/** Register room/rate/availability proxy and inventory command routes on the gateway. */
export const registerRoomRoutes = (app: FastifyInstance): void => {
  const proxyRooms = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.roomsServiceUrl);

  /**
   * The booking funnel's two hot reads, served from a short-lived per-process
   * cache. Both were measured queueing to a multi-second median under load
   * while answering in single-digit milliseconds idle — the cost is repetition,
   * not the query. See `utils/cached-read.ts` for why caching availability does
   * not risk overbooking.
   */
  const availabilityRead = createCachedRead({
    name: "rooms-availability",
    ttlMs: cachedReadConfig.availabilityTtlMs,
    maxSize: cachedReadConfig.maxEntries,
    targetBaseUrl: () => serviceTargets.roomsServiceUrl,
  });

  const ratesRead = createCachedRead({
    name: "rates",
    ttlMs: cachedReadConfig.ratesTtlMs,
    maxSize: cachedReadConfig.maxEntries,
    targetBaseUrl: () => serviceTargets.roomsServiceUrl,
  });

  /**
   * Writing a rate makes this tenant's cached rate lookups wrong immediately,
   * and can change what a search should show, so both are dropped rather than
   * left to expire.
   */
  const proxyRoomsInvalidating = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await proxyRequest(request, reply, serviceTargets.roomsServiceUrl);
    const tenantId =
      (request.query as { tenant_id?: string } | undefined)?.tenant_id ??
      (request.body as { tenant_id?: string } | undefined)?.tenant_id;
    if (tenantId) {
      ratesRead.invalidateTenant(tenantId);
      availabilityRead.invalidateTenant(tenantId);
    }
    return result;
  };

  /**
   * Write scope for the command routes below.
   *
   * `COMMAND_AUTHORITY_FLOOR` is the lowest role any command declares, not a
   * blanket relaxation: the command's own floor in `COMMAND_MIN_ROLE` decides
   * the outcome inside `acceptCommand`. Holding this at MANAGER, as it was,
   * refused a clerk their own routine work before that check could run.
   */
  const tenantWriteScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: COMMAND_AUTHORITY_FLOOR,
    requiredModules: "core",
  });

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "VIEWER",
    requiredModules: "core",
  });

  /**
   * Wildcard scope — query *or* body.
   *
   * The `/v1/rooms/*`, `/v1/buildings/*` and `/v1/rates/*` wildcards carry reads
   * and writes together, and every write the front end sends puts `tenant_id` in
   * the JSON body rather than the query string — `PUT /v1/rooms/:roomId` from
   * both room-detail and housekeeping, `PUT /v1/rates/:rateId`,
   * `PUT`/`DELETE /v1/buildings/:buildingId`. Resolving from the query alone
   * rejected all of them with 400 TENANT_ID_REQUIRED at the edge, before the
   * request ever reached rooms-service. Same failure the booking-config
   * wildcards had; see ui-gaps/18-write-path-gap.md.
   *
   * The role stays VIEWER, which is what these wildcards already required — this
   * changes *where* the tenant is read from, nothing about who may write.
   */
  const tenantScopeFromQueryOrBody = app.withTenantScope({
    resolveTenantId: (request) =>
      (request.query as { tenant_id?: string })?.tenant_id ??
      (request.body as { tenant_id?: string } | undefined)?.tenant_id,
    minRole: "VIEWER",
    requiredModules: "core",
  });

  /** Write scope for POST/PUT/PATCH — reads tenant_id from request body. */
  const tenantWriteScopeFromBody = app.withTenantScope({
    resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  app.get(
    "/v1/rooms/grid",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room grid queries to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: roomGridResponse,
        },
      }),
    },
    proxyRooms,
  );

  app.get(
    "/v1/rooms",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room queries to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: roomListResponse,
        },
      }),
    },
    proxyRooms,
  );

  app.post(
    "/v1/rooms",
    {
      preHandler: tenantWriteScopeFromBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room creation to the rooms service.",
        body: jsonObjectSchema,
        response: {
          201: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.all(
    "/v1/rooms/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room updates to the rooms service.",
        response: {
          200: jsonObjectSchema,
          204: { type: "null" },
        },
      }),
    },
    proxyRooms,
  );

  app.get(
    "/v1/room-types/grid",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type grid requests to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: roomTypeGridResponse,
        },
      }),
    },
    proxyRooms,
  );

  app.get(
    "/v1/room-types",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type list requests to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: roomTypeListResponse,
        },
      }),
    },
    proxyRooms,
  );

  app.post(
    "/v1/room-types",
    {
      preHandler: tenantWriteScopeFromBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type creation to the rooms service.",
        body: jsonObjectSchema,
        response: {
          201: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.get(
    "/v1/room-types/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type detail requests to the rooms service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.put(
    "/v1/room-types/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type updates to the rooms service.",
        body: jsonObjectSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.patch(
    "/v1/room-types/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type partial updates to the rooms service.",
        body: jsonObjectSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.delete(
    "/v1/room-types/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type deletion to the rooms service.",
        response: {
          204: { type: "null" },
        },
      }),
    },
    proxyRooms,
  );

  // Buildings routes - proxy to rooms service
  app.get(
    "/v1/buildings/grid",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy building grid requests to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.get(
    "/v1/buildings",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy building list requests to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.post(
    "/v1/buildings",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy building creation to the rooms service.",
        body: jsonObjectSchema,
        response: {
          201: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.all(
    "/v1/buildings/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy building operations to the rooms service.",
        response: {
          200: jsonObjectSchema,
          204: { type: "null" },
        },
      }),
    },
    proxyRooms,
  );

  // Rates routes - proxy to rooms service
  app.get(
    "/v1/rates",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List rates for a tenant.",
        querystring: paginationQuerySchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    ratesRead.handler,
  );

  app.post(
    "/v1/rates",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Create a new rate.",
        body: jsonObjectSchema,
        response: {
          201: jsonObjectSchema,
        },
      }),
    },
    proxyRoomsInvalidating,
  );

  app.all(
    "/v1/rates/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy rate operations to rooms service.",
        response: {
          200: jsonObjectSchema,
          204: { type: "null" },
        },
      }),
    },
    proxyRooms,
  );

  // Rate Calendar routes - proxy to rooms service
  app.get(
    "/v1/rate-calendar",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List rate calendar entries for a date range.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.put(
    "/v1/rate-calendar",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Bulk upsert rate calendar day entries.",
        body: jsonObjectSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.post(
    "/v1/rate-calendar/range-fill",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Fill a date range with a uniform rate.",
        body: jsonObjectSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  // ─── Availability / ARI Endpoints ──────────────────────────

  /**
   * The one availability endpoint that exists downstream.
   *
   * `/v1/availability`, `/v1/availability/calendar` and `/v1/availability/room-types`
   * were declared here and proxied to rooms-service, which registers none of them —
   * three documented endpoints that always 404. Every caller (both front-ends and
   * the E2E suite's reservation flows) already used `/v1/rooms/availability`, which
   * reached rooms-service through the `/v1/rooms/*` catch-all undeclared. Declaring
   * it explicitly is what the ARI tag should have pointed at all along.
   * See ui-gaps/19-gateway-proxy-mismatches.md.
   */
  app.get(
    "/v1/rooms/availability",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: AVAILABILITY_TAG,
        summary: "Search available rooms for a date range (ARI: availability, rates, inventory).",
        response: { 200: jsonObjectSchema },
      }),
    },
    availabilityRead.handler,
  );

  // Room command routes
  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/block",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: ROOM_COMMAND_TAG,
        summary: "Block a room's inventory via the Command Center.",
        params: tenantRoomParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardRoomInventoryCommand({
        request,
        reply,
        action: "block",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/release",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: ROOM_COMMAND_TAG,
        summary: "Release a manual room block via the Command Center.",
        params: tenantRoomParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardRoomInventoryCommand({
        request,
        reply,
        action: "release",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/status",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: ROOM_COMMAND_TAG,
        summary: "Update room status via Command Center.",
        params: tenantRoomParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "rooms.status.update",
        paramKey: "roomId",
        payloadKey: "room_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/housekeeping-status",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: ROOM_COMMAND_TAG,
        summary: "Update room housekeeping status via Command Center.",
        params: tenantRoomParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "rooms.housekeeping_status.update",
        paramKey: "roomId",
        payloadKey: "room_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/out-of-order",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: ROOM_COMMAND_TAG,
        summary: "Mark room out of order via Command Center.",
        params: tenantRoomParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "rooms.out_of_order",
        paramKey: "roomId",
        payloadKey: "room_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/out-of-service",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: ROOM_COMMAND_TAG,
        summary: "Mark room out of service via Command Center.",
        params: tenantRoomParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "rooms.out_of_service",
        paramKey: "roomId",
        payloadKey: "room_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/features",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: ROOM_COMMAND_TAG,
        summary: "Update room features via Command Center.",
        params: tenantRoomParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "rooms.features.update",
        paramKey: "roomId",
        payloadKey: "room_id",
      }),
  );
};
