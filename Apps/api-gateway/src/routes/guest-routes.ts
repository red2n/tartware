import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import {
  forwardCommandWithParamId,
  forwardGuestMergeCommand,
  forwardGuestRegisterCommand,
} from "./command-helpers.js";
import {
  commandAcceptedSchema,
  GDPR_TAG,
  GUESTS_PROXY_TAG,
  paginationQuerySchema,
  tenantGuestParamsSchema,
} from "./schemas.js";

export const registerGuestRoutes = (app: FastifyInstance): void => {
  const proxyGuests = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.guestsServiceUrl);

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
    "/v1/guests",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Proxy guest queries to the guests service.",
        querystring: paginationQuerySchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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

  // -------------------------------------------------
  // GDPR / CCPA COMPLIANCE ENDPOINTS
  // -------------------------------------------------

  app.get(
    "/v1/tenants/:tenantId/guests/:guestId/gdpr-export",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GDPR_TAG,
        summary: "Subject access request — export all guest data (GDPR Art. 15 / CCPA).",
        params: tenantGuestParamsSchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyGuests,
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/gdpr-rectify",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GDPR_TAG,
        summary: "Rectify guest personal data (GDPR Art. 16).",
        params: tenantGuestParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "guest.gdpr.rectify",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/gdpr-restrict",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GDPR_TAG,
        summary: "Restrict processing of guest data (GDPR Art. 18).",
        params: tenantGuestParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "guest.gdpr.restrict",
        paramKey: "guestId",
        payloadKey: "guest_id",
      }),
  );

  app.get(
    "/v1/tenants/:tenantId/guests/:guestId/consent",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GDPR_TAG,
        summary: "Get guest consent ledger (marketing, analytics, third-party sharing).",
        params: tenantGuestParamsSchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyGuests,
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/consent",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: GDPR_TAG,
        summary: "Update guest consent preferences.",
        params: tenantGuestParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "guest.consent.update",
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
          202: commandAcceptedSchema,
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

  // -------------------------------------------------
  // LOYALTY READ ENDPOINTS (proxied to guests-service)
  // -------------------------------------------------

  app.get(
    "/v1/loyalty/transactions",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "List loyalty point transactions.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyGuests,
  );

  app.get(
    "/v1/loyalty/tier-rules",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "List loyalty tier rules and benefits.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyGuests,
  );

  app.get(
    "/v1/loyalty/programs/:programId/balance",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Get loyalty program balance.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyGuests,
  );

  app.get(
    "/v1/guests/*",
    {
      preHandler: tenantScopeFromQuery,
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
