import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { forwardCommandWithParamId, forwardRoomInventoryCommand } from "./command-helpers.js";
import {
  AVAILABILITY_TAG,
  CORE_PROXY_TAG,
  commandAcceptedSchema,
  paginationQuerySchema,
  ROOM_COMMAND_TAG,
  tenantRoomParamsSchema,
} from "./schemas.js";

export const registerRoomRoutes = (app: FastifyInstance): void => {
  const proxyRooms = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.roomsServiceUrl);

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "VIEWER",
    requiredModules: "core",
  });

  app.get(
    "/v1/rooms",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room queries to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.post(
    "/v1/rooms",
    {
      preHandler: tenantScopeFromQuery,
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
      preHandler: tenantScopeFromQuery,
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
    "/v1/room-types",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy room type list requests to the rooms service.",
        querystring: paginationQuerySchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRooms,
  );

  app.post(
    "/v1/room-types",
    {
      preHandler: tenantScopeFromQuery,
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
    proxyRooms,
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
    proxyRooms,
  );

  app.all(
    "/v1/rates/*",
    {
      preHandler: tenantScopeFromQuery,
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

  app.get(
    "/v1/availability",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: AVAILABILITY_TAG,
        summary: "Query room availability for a date range (ARI: availability, rates, inventory).",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyRooms,
  );

  app.get(
    "/v1/availability/calendar",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: AVAILABILITY_TAG,
        summary: "Room availability calendar view by room type and date.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyRooms,
  );

  app.get(
    "/v1/availability/room-types",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: AVAILABILITY_TAG,
        summary: "Available room types with counts for a date range.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyRooms,
  );

  // Room command routes
  app.post(
    "/v1/tenants/:tenantId/rooms/:roomId/block",
    {
      preHandler: tenantScopeFromParams,
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
      preHandler: tenantScopeFromParams,
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
      preHandler: tenantScopeFromParams,
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
      preHandler: tenantScopeFromParams,
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
      preHandler: tenantScopeFromParams,
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
      preHandler: tenantScopeFromParams,
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
      preHandler: tenantScopeFromParams,
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
