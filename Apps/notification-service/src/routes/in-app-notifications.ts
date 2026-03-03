import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import {
  getUnreadCount,
  listInAppNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from "../services/in-app-notification-service.js";
import { sseManager } from "../services/sse-manager.js";

type TenantParams = { tenantId: string };
type ListQuery = {
  limit?: string;
  offset?: string;
  category?: string;
  is_read?: string;
  priority?: string;
};

/**
 * Register in-app notification REST and SSE routes.
 *
 * - GET  /v1/tenants/:tenantId/in-app-notifications          — List notifications
 * - GET  /v1/tenants/:tenantId/in-app-notifications/unread    — Unread count
 * - PUT  /v1/tenants/:tenantId/in-app-notifications/read      — Mark specific as read
 * - PUT  /v1/tenants/:tenantId/in-app-notifications/read-all  — Mark all as read
 * - GET  /v1/tenants/:tenantId/in-app-notifications/stream    — SSE stream
 */
export const registerInAppNotificationRoutes = (app: FastifyInstance): void => {
  // ─── List notifications ──────────────────────────────────────

  app.get<{ Params: TenantParams; Querystring: ListQuery }>(
    "/v1/tenants/:tenantId/in-app-notifications",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TenantParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const userId = request.auth.userId ?? undefined;

      const result = await listInAppNotifications(tenantId, {
        limit: Number(request.query.limit) || 50,
        offset: Number(request.query.offset) || 0,
        category: request.query.category,
        is_read: request.query.is_read,
        priority: request.query.priority,
        userId,
      });

      return reply.send(result);
    },
  );

  // ─── Unread count ────────────────────────────────────────────

  app.get<{ Params: TenantParams }>(
    "/v1/tenants/:tenantId/in-app-notifications/unread",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TenantParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const userId = request.auth.userId ?? undefined;

      const unread = await getUnreadCount(tenantId, userId);
      return reply.send({ data: { unread } });
    },
  );

  // ─── Mark specific notifications as read ─────────────────────

  app.put<{ Params: TenantParams; Body: { notification_ids: string[] } }>(
    "/v1/tenants/:tenantId/in-app-notifications/read",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TenantParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const { notification_ids } = request.body;

      if (!Array.isArray(notification_ids) || notification_ids.length === 0) {
        return reply.badRequest("notification_ids must be a non-empty array");
      }
      if (notification_ids.length > 100) {
        return reply.badRequest("Cannot mark more than 100 notifications at once");
      }

      const updated = await markNotificationsRead(tenantId, notification_ids);

      // Push updated unread count via SSE
      const userId = request.auth.userId;
      if (userId) {
        const unread = await getUnreadCount(tenantId, userId);
        sseManager.sendUnreadCount(tenantId, userId, unread);
      }

      return reply.send({ data: { updated } });
    },
  );

  // ─── Mark all as read ────────────────────────────────────────

  app.put<{ Params: TenantParams }>(
    "/v1/tenants/:tenantId/in-app-notifications/read-all",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TenantParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const updated = await markAllNotificationsRead(tenantId);

      // Push updated unread count via SSE
      const userId = request.auth.userId;
      if (userId) {
        sseManager.sendUnreadCount(tenantId, userId, 0);
      }

      return reply.send({ data: { updated } });
    },
  );

  // ─── SSE Stream ──────────────────────────────────────────────

  app.get<{ Params: TenantParams }>(
    "/v1/tenants/:tenantId/in-app-notifications/stream",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TenantParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const userId = request.auth.userId;

      if (!userId) {
        return reply.unauthorized("User context required for SSE stream");
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      });

      // Send initial unread count
      const unread = await getUnreadCount(tenantId, userId);
      reply.raw.write(`event: unread_count\ndata: ${JSON.stringify({ unread })}\n\n`);

      // Register the SSE client
      const client = {
        id: randomUUID(),
        tenantId,
        userId,
        reply,
      };
      sseManager.addClient(client);

      // Clean up on disconnect
      request.raw.on("close", () => {
        sseManager.removeClient(client);
      });

      // Don't end the response — keep the stream open
      // Returning void after hijacking the response
    },
  );
};
