import type { FastifyReply } from "fastify";

import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "sse-manager" });

type SseClient = {
  id: string;
  tenantId: string;
  userId: string;
  reply: FastifyReply;
};

/**
 * Manages Server-Sent Events (SSE) connections for real-time in-app notifications.
 * Clients are keyed by tenantId + userId so we can push notifications to specific users.
 */
class SseConnectionManager {
  private readonly clients = new Map<string, Set<SseClient>>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /** Generate a composite key for tenant+user */
  private key(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }

  /** Add a new SSE client connection */
  addClient(client: SseClient): void {
    const k = this.key(client.tenantId, client.userId);
    if (!this.clients.has(k)) {
      this.clients.set(k, new Set());
    }
    this.clients.get(k)!.add(client);

    if (!this.heartbeatInterval) {
      this.startHeartbeat();
    }

    logger.info(
      { clientId: client.id, tenantId: client.tenantId, userId: client.userId },
      "SSE client connected",
    );
  }

  /** Remove an SSE client connection */
  removeClient(client: SseClient): void {
    const k = this.key(client.tenantId, client.userId);
    const clients = this.clients.get(k);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.clients.delete(k);
      }
    }

    if (this.clients.size === 0 && this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    logger.debug(
      { clientId: client.id, tenantId: client.tenantId, userId: client.userId },
      "SSE client disconnected",
    );
  }

  /** Send a notification event to a specific user */
  sendToUser(tenantId: string, userId: string, data: unknown): void {
    const k = this.key(tenantId, userId);
    const clients = this.clients.get(k);
    if (!clients || clients.size === 0) return;

    const payload = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.reply.raw.write(payload);
      } catch {
        this.removeClient(client);
      }
    }
  }

  /** Broadcast a notification to all connected users in a tenant (optionally filtered by property) */
  broadcastToTenant(tenantId: string, data: unknown): void {
    const payload = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [key, clients] of this.clients) {
      if (!key.startsWith(`${tenantId}:`)) continue;
      for (const client of clients) {
        try {
          client.reply.raw.write(payload);
        } catch {
          this.removeClient(client);
        }
      }
    }
  }

  /** Send an unread count update to a specific user */
  sendUnreadCount(tenantId: string, userId: string, unread: number): void {
    const k = this.key(tenantId, userId);
    const clients = this.clients.get(k);
    if (!clients || clients.size === 0) return;

    const payload = `event: unread_count\ndata: ${JSON.stringify({ unread })}\n\n`;
    for (const client of clients) {
      try {
        client.reply.raw.write(payload);
      } catch {
        this.removeClient(client);
      }
    }
  }

  /** Start heartbeat to keep connections alive */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const payload = `event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
      for (const clients of this.clients.values()) {
        for (const client of clients) {
          try {
            client.reply.raw.write(payload);
          } catch {
            this.removeClient(client);
          }
        }
      }
    }, 30_000); // Every 30 seconds
  }

  /** Get total connected client count (for metrics/health) */
  get connectionCount(): number {
    let count = 0;
    for (const clients of this.clients.values()) {
      count += clients.size;
    }
    return count;
  }

  /** Shutdown: close all connections */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.clear();
  }
}

export const sseManager = new SseConnectionManager();
