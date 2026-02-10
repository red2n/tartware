import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";
import {
  COMMAND_CENTER_PROXY_TAG,
  SETTINGS_PROXY_TAG,
  RECOMMENDATION_PROXY_TAG,
  NOTIFICATION_PROXY_TAG,
  NOTIFICATION_COMMAND_TAG,
  tenantCommandParamsSchema,
  reservationParamsSchema,
} from "./schemas.js";
import { forwardGenericCommand, forwardCommandWithTenant, forwardCommandWithParamId } from "./command-helpers.js";

export const registerMiscRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  // ─── Command Center Routes ──────────────────────────────────────

  const proxyCommandCenter = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.commandCenterServiceUrl);

  app.all(
    "/v1/commands",
    {
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_PROXY_TAG,
        summary: "Proxy command center calls to the command-center service.",
        response: {
          200: jsonObjectSchema,
          202: jsonObjectSchema,
        },
      }),
    },
    proxyCommandCenter,
  );

  app.all(
    "/v1/commands/*",
    {
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_PROXY_TAG,
        summary: "Proxy command center calls to the command-center service.",
        response: {
          200: jsonObjectSchema,
          202: jsonObjectSchema,
        },
      }),
    },
    proxyCommandCenter,
  );

  app.post(
    "/v1/tenants/:tenantId/commands/:commandName",
    {
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_PROXY_TAG,
        summary: "Dispatch a command by name via the Command Center.",
        params: tenantCommandParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    forwardGenericCommand,
  );

  // ─── Settings Routes ──────────────────────────────────────

  const proxySettings = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.settingsServiceUrl);

  app.all(
    "/v1/settings",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_PROXY_TAG,
        summary: "Proxy settings requests to the settings service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxySettings,
  );

  app.all(
    "/v1/settings/*",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_PROXY_TAG,
        summary: "Proxy settings requests to the settings service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxySettings,
  );

  // ─── Recommendation Routes ──────────────────────────────────────

  const proxyRecommendations = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.recommendationServiceUrl);

  app.get(
    "/v1/recommendations",
    {
      schema: buildRouteSchema({
        tag: RECOMMENDATION_PROXY_TAG,
        summary: "Get personalized room recommendations for a guest.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRecommendations,
  );

  app.post(
    "/v1/recommendations/rank",
    {
      schema: buildRouteSchema({
        tag: RECOMMENDATION_PROXY_TAG,
        summary: "Rank a list of rooms for a guest (personalized ordering).",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRecommendations,
  );

  app.all(
    "/v1/recommendations/*",
    {
      schema: buildRouteSchema({
        tag: RECOMMENDATION_PROXY_TAG,
        summary: "Proxy recommendation requests to the recommendation service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyRecommendations,
  );

  // ─── Notification Routes ──────────────────────────────────────

  const proxyNotifications = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.notificationServiceUrl);

  app.get(
    "/v1/tenants/:tenantId/notifications/templates",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "List notification templates for a tenant.",
        params: reservationParamsSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.get(
    "/v1/tenants/:tenantId/notifications/templates/:templateId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "Get a specific notification template.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.post(
    "/v1/tenants/:tenantId/notifications/templates",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_COMMAND_TAG,
        summary: "Create a notification template via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "notification.template.create",
      }),
  );

  app.put(
    "/v1/tenants/:tenantId/notifications/templates/:templateId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_COMMAND_TAG,
        summary: "Update a notification template via the Command Center.",
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
        commandName: "notification.template.update",
        paramKey: "templateId",
        payloadKey: "template_id",
      }),
  );

  app.delete(
    "/v1/tenants/:tenantId/notifications/templates/:templateId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_COMMAND_TAG,
        summary: "Delete a notification template via the Command Center.",
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "notification.template.delete",
        paramKey: "templateId",
        payloadKey: "template_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/notifications/send",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_COMMAND_TAG,
        summary: "Send a notification to a guest via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "notification.send",
      }),
  );

  app.get(
    "/v1/tenants/:tenantId/notifications/guests/:guestId/communications",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "List guest communication history.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.get(
    "/v1/tenants/:tenantId/notifications/communications/:communicationId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "Get a specific guest communication.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );
};
