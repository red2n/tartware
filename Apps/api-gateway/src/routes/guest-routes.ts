/**
 * Guest management proxy and command routes.
 *
 * Read endpoints (GET) proxy to the guests service for guest search,
 * loyalty, and compliance queries. Write endpoints (POST) dispatch
 * commands through the Command Center for guest registration, profile
 * updates, VIP/blacklist management, GDPR erasure/rectification,
 * and consent management.
 *
 * @module guest-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import { COMMAND_AUTHORITY_FLOOR } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import {
  forwardCommandWithParamId,
  forwardGuestMergeCommand,
  forwardGuestRegisterCommand,
} from "./command-helpers.js";
import { guestGridResponse, programBalanceResponse } from "./response-schemas.js";
import {
  commandAcceptedSchema,
  GDPR_TAG,
  GUESTS_PROXY_TAG,
  guestIdParamsSchema,
  paginationQuerySchema,
  tenantGuestParamsSchema,
  tenantQuerySchema,
} from "./schemas.js";

/** Register guest read-proxy and command-dispatch routes on the gateway. */
export const registerGuestRoutes = (app: FastifyInstance): void => {
  const proxyGuests = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.guestsServiceUrl);

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
    minRole: "STAFF",
    requiredModules: "core",
  });

  app.get(
    "/v1/guests/grid",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Proxy guest grid queries to the guests service.",
        querystring: paginationQuerySchema,
        response: {
          200: guestGridResponse,
        },
      }),
    },
    proxyGuests,
  );

  app.get(
    "/v1/guests",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Proxy guest queries to the guests service.",
        querystring: paginationQuerySchema,
        response: {
          200: guestGridResponse,
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
      preHandler: tenantWriteScopeFromParams,
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
      preHandler: tenantWriteScopeFromParams,
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
      preHandler: tenantWriteScopeFromParams,
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
      preHandler: tenantWriteScopeFromParams,
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
      preHandler: tenantWriteScopeFromParams,
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
      preHandler: tenantWriteScopeFromParams,
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

  /**
   * Reads proxy straight through, so the path must be the one guests-service
   * registers — `/v1/guests/:guestId/…`, tenant resolved from `tenant_id`, the
   * same shape as every other proxied guest read here. This route was declared
   * as `/v1/tenants/:tenantId/guests/:guestId/gdpr-export` and answered 404 for
   * every subject access request the UI made. See ui-gaps/19-gateway-proxy-mismatches.md.
   */
  app.get(
    "/v1/guests/:guestId/gdpr-export",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GDPR_TAG,
        summary: "Subject access request — export all guest data (GDPR Art. 15 / CCPA).",
        params: guestIdParamsSchema,
        querystring: tenantQuerySchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyGuests,
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/gdpr-rectify",
    {
      preHandler: tenantWriteScopeFromParams,
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
      preHandler: tenantWriteScopeFromParams,
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

  /** Proxied read — see the gdpr-export note above on why this is not tenant-scoped by path. */
  app.get(
    "/v1/guests/:guestId/consent",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: GDPR_TAG,
        summary: "Get guest consent ledger (marketing, analytics, third-party sharing).",
        params: guestIdParamsSchema,
        querystring: tenantQuerySchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyGuests,
  );

  app.post(
    "/v1/tenants/:tenantId/guests/:guestId/consent",
    {
      preHandler: tenantWriteScopeFromParams,
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
      preHandler: tenantWriteScopeFromParams,
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

  app.post(
    "/v1/loyalty/tier-rules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Create or update a loyalty tier rule.",
        response: { 201: jsonObjectSchema },
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
        response: { 200: programBalanceResponse },
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

  /**
   * The privacy writes under this prefix (CCPA opt-out, communication
   * preferences) are PUT-only and MANAGER-gated in guests-service. Only PUT is
   * registered: a POST/DELETE wildcard here would advertise a write surface the
   * service does not implement — see ui-gaps/18-write-path-gap.md.
   */
  const guestWriteScopeFromQueryOrBody = app.withTenantScope({
    resolveTenantId: (request) =>
      (request.query as { tenant_id?: string })?.tenant_id ??
      (request.body as { tenant_id?: string } | undefined)?.tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  app.put(
    "/v1/guests/*",
    {
      preHandler: guestWriteScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: GUESTS_PROXY_TAG,
        summary: "Proxy nested guest privacy updates to the guests service.",
        body: jsonObjectSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyGuests,
  );
};
