import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";

import { serviceTargets } from "../config.js";
import { submitCommand } from "../utils/command-publisher.js";
import { proxyRequest } from "../utils/proxy.js";
import {
  RESERVATION_PROXY_TAG,
  reservationParamsSchema,
  tenantReservationParamsSchema,
  waitlistConvertParamsSchema,
} from "./schemas.js";
import { forwardCommandWithParamId, forwardReservationCommand } from "./command-helpers.js";

export const registerReservationRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const reservationHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method.toUpperCase() === "GET") {
      return proxyRequest(request, reply, serviceTargets.coreServiceUrl);
    }
    return forwardReservationCommand(request, reply);
  };

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "STAFF",
    requiredModules: "core",
  });

  app.get(
    "/v1/reservations",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Proxy reservation queries to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.get(
    "/v1/reservations/:id",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Get a single reservation by ID with folio and status history.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/tenants/:tenantId/reservations",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Proxy tenant reservation requests to the backing services.",
        params: reservationParamsSchema,
        response: {
          200: jsonObjectSchema,
          201: jsonObjectSchema,
          202: jsonObjectSchema,
        },
      }),
    },
    reservationHandler,
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/cancel",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Cancel a reservation via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.cancel",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/check-in",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Check in a reservation via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.check_in",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/check-out",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Check out a reservation via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.check_out",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/assign-room",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Assign a room to a reservation via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.assign_room",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/unassign-room",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Unassign a room from a reservation via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.unassign_room",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/extend",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Extend a reservation stay via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.extend_stay",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/rate-override",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Override reservation rates via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.rate_override",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/deposit/add",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Add a deposit to a reservation via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.add_deposit",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/deposit/release",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Release a reservation deposit via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.release_deposit",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/no-show",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Mark a reservation as no-show via Command Center.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "reservation.no_show",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/walk-in",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary:
          "Walk-in express check-in: create reservation + assign room + check-in atomically.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      return submitCommand({
        request,
        reply,
        commandName: "reservation.walkin_checkin",
        tenantId,
        payload: { ...body, tenant_id: tenantId },
      });
    },
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/waitlist",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Add a guest to the room waitlist.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      return submitCommand({
        request,
        reply,
        commandName: "reservation.waitlist_add",
        tenantId,
        payload: { ...body, tenant_id: tenantId },
      });
    },
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/waitlist/:waitlistId/convert",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Convert a waitlist entry into a confirmed reservation.",
        params: waitlistConvertParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    async (request, reply) => {
      const { tenantId, waitlistId } = request.params as { tenantId: string; waitlistId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      return submitCommand({
        request,
        reply,
        commandName: "reservation.waitlist_convert",
        tenantId,
        payload: { ...body, tenant_id: tenantId, waitlist_id: waitlistId },
      });
    },
  );

  // Reservation wildcard catch-all
  app.all(
    "/v1/tenants/:tenantId/reservations/*",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: RESERVATION_PROXY_TAG,
        summary: "Proxy nested reservation resource calls.",
        params: reservationParamsSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    reservationHandler,
  );
};
