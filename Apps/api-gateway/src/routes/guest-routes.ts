import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";
import { GUESTS_PROXY_TAG, tenantGuestParamsSchema } from "./schemas.js";
import {
  forwardGuestRegisterCommand,
  forwardGuestMergeCommand,
  forwardCommandWithParamId,
} from "./command-helpers.js";

export const registerGuestRoutes = (app: FastifyInstance): void => {
  const proxyGuests = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.guestsServiceUrl);

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  app.get(
    "/v1/guests",
    {
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Proxy guest queries to the guests service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyGuests,
  );

  app.post(
    "/v1/guests",
    {
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Submit guest creation requests via the Command Center command pipeline.",
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    forwardGuestRegisterCommand,
  );

  app.post(
    "/v1/guests/merge",
    {
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Merge duplicate guests via the Command Center pipeline.",
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    forwardGuestMergeCommand,
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/profile",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Update guest profile details via Command Center.",
        params: tenantGuestParamsSchema,
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
        commandName: "guest.update_profile",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/contact",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Update guest contact details via Command Center.",
        params: tenantGuestParamsSchema,
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
        commandName: "guest.update_contact",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/loyalty",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Update guest loyalty information via Command Center.",
        params: tenantGuestParamsSchema,
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
        commandName: "guest.set_loyalty",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/vip",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Update guest VIP status via Command Center.",
        params: tenantGuestParamsSchema,
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
        commandName: "guest.set_vip",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/blacklist",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Update guest blacklist status via Command Center.",
        params: tenantGuestParamsSchema,
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
        commandName: "guest.set_blacklist",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/gdpr-erase",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Erase guest data for GDPR via Command Center.",
        params: tenantGuestParamsSchema,
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
        commandName: "guest.gdpr.erase",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/preferences",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Update guest preferences via Command Center.",
        params: tenantGuestParamsSchema,
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
        commandName: "guest.preference.update",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.get(
    "/v1/guests/*",
    {
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Proxy nested guest routes to the guests service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyGuests,
  );
};
