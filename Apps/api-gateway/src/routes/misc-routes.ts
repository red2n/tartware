/**
 * Miscellaneous proxy and command routes.
 *
 * Groups lower-traffic route families that don’t warrant their own file:
 * - **Command Center** — Admin command browsing and generic command dispatch
 *   with a command-tier rate limit.
 * - **Settings** — Tenant settings and package configuration proxy.
 * - **Recommendations** — Personalized room ranking proxy.
 * - **Notifications** — Template CRUD, send, communication history, and
 *   automated message rule management.
 *
 * @module misc-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { gatewayConfig, serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import {
  forwardCommandWithParamId,
  forwardCommandWithTenant,
  forwardGenericCommand,
} from "./command-helpers.js";
import {
  COMMAND_CENTER_PROXY_TAG,
  commandAcceptedSchema,
  NOTIFICATION_COMMAND_TAG,
  NOTIFICATION_PROXY_TAG,
  RECOMMENDATION_PROXY_TAG,
  reservationParamsSchema,
  SETTINGS_PROXY_TAG,
  tenantCommandParamsSchema,
} from "./schemas.js";

/** Register command center, settings, recommendation, and notification routes on the gateway. */
export const registerMiscRoutes = (app: FastifyInstance): void => {
  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  const authenticatedOnly = app.withTenantScope({
    allowMissingTenantId: true,
    minRole: "VIEWER",
  });

  const adminOnly = app.withTenantScope({
    allowMissingTenantId: true,
    minRole: "ADMIN",
  });

  // ─── Command Center Routes ──────────────────────────────────────

  const proxyCommandCenter = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.commandCenterServiceUrl);

  app.all(
    "/v1/commands",
    {
      preHandler: adminOnly,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_PROXY_TAG,
        summary: "Proxy command center calls to the command-center service.",
        response: {
          200: jsonObjectSchema,
          202: commandAcceptedSchema,
        },
      }),
    },
    proxyCommandCenter,
  );

  app.all(
    "/v1/commands/*",
    {
      preHandler: adminOnly,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_PROXY_TAG,
        summary: "Proxy command center calls to the command-center service.",
        response: {
          200: jsonObjectSchema,
          202: commandAcceptedSchema,
        },
      }),
    },
    proxyCommandCenter,
  );

  app.post(
    "/v1/tenants/:tenantId/commands/:commandName",
    {
      preHandler: tenantScopeFromParams,
      config: {
        rateLimit: {
          max: gatewayConfig.rateLimit.commandMax,
          timeWindow: gatewayConfig.rateLimit.commandTimeWindow,
        },
      },
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_PROXY_TAG,
        summary: "Dispatch a command by name via the Command Center.",
        params: tenantCommandParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
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
      preHandler: authenticatedOnly,
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
      preHandler: authenticatedOnly,
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
    "/v1/packages",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: SETTINGS_PROXY_TAG,
        summary: "Proxy package requests to the settings service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxySettings,
  );

  app.all(
    "/v1/packages/*",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: SETTINGS_PROXY_TAG,
        summary: "Proxy package requests to the settings service.",
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
      preHandler: authenticatedOnly,
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
      preHandler: authenticatedOnly,
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
      preHandler: authenticatedOnly,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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
          202: commandAcceptedSchema,
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

  // ─── Automated Messages (Read + Command) ─────────────────────

  app.get(
    "/v1/tenants/:tenantId/notifications/automated-messages",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "List automated message rules for a tenant.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.get(
    "/v1/tenants/:tenantId/notifications/automated-messages/:messageId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "Get a specific automated message rule.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.post(
    "/v1/tenants/:tenantId/notifications/automated-messages",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_COMMAND_TAG,
        summary: "Create an automated message rule via the Command Center.",
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "notification.automated.create",
      }),
  );

  app.put(
    "/v1/tenants/:tenantId/notifications/automated-messages/:messageId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_COMMAND_TAG,
        summary: "Update an automated message rule via the Command Center.",
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
        commandName: "notification.automated.update",
        paramKey: "messageId",
        payloadKey: "message_id",
      }),
  );

  app.delete(
    "/v1/tenants/:tenantId/notifications/automated-messages/:messageId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_COMMAND_TAG,
        summary: "Delete an automated message rule via the Command Center.",
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "notification.automated.delete",
        paramKey: "messageId",
        payloadKey: "message_id",
      }),
  );

  // ─── In-App Notifications ──────────────────────────────────────

  app.get(
    "/v1/tenants/:tenantId/in-app-notifications",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "List in-app notifications for the current user.",
        params: reservationParamsSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.get(
    "/v1/tenants/:tenantId/in-app-notifications/unread",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "Get unread notification count.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.put(
    "/v1/tenants/:tenantId/in-app-notifications/read",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "Mark specific notifications as read.",
        body: jsonObjectSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.put(
    "/v1/tenants/:tenantId/in-app-notifications/read-all",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "Mark all notifications as read.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyNotifications,
  );

  app.get(
    "/v1/tenants/:tenantId/in-app-notifications/stream",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: NOTIFICATION_PROXY_TAG,
        summary: "SSE stream for real-time in-app notifications (text/event-stream).",
      }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // SSE requires special proxy handling — stream the response
      const target = `${serviceTargets.notificationServiceUrl}${request.url}`;
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
      };
      const authHeader = request.headers.authorization;
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
      const tenantHeader = request.headers["x-tenant-id"];
      if (tenantHeader) {
        headers["x-tenant-id"] = String(tenantHeader);
      }

      try {
        const response = await fetch(target, {
          headers,
        });

        if (!response.ok || !response.body) {
          return reply.badGateway("SSE connection failed");
        }

        // Hijack the reply so Fastify does not auto-finalize
        reply.hijack();

        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });

        const reader = response.body.getReader();
        const pump = async () => {
          try {
            let done = false;
            while (!done) {
              const result = await reader.read();
              done = result.done;
              if (!done) {
                reply.raw.write(result.value);
              }
            }
          } catch {
            // Client disconnected
          } finally {
            reply.raw.end();
          }
        };

        request.raw.on("close", () => {
          reader.cancel().catch(() => {});
        });

        void pump();
      } catch {
        return reply.badGateway("Failed to connect to notification service");
      }
    },
  );
};
