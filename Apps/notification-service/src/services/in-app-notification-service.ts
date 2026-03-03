import type { CreateInAppNotification } from "@tartware/schemas";

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { sseManager } from "./sse-manager.js";

const logger = appLogger.child({ module: "in-app-notification-service" });

const INSERT_SQL = `
  INSERT INTO in_app_notifications (
    tenant_id, property_id, user_id, title, message,
    category, priority, source_type, source_id, action_url,
    metadata, expires_at
  ) VALUES (
    $1::uuid, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12
  )
  RETURNING notification_id, tenant_id, property_id, user_id, title, message,
            category, priority, source_type, source_id, action_url,
            is_read, read_at, metadata, created_at
`;

const LIST_SQL = `
  SELECT notification_id, tenant_id, property_id, user_id, title, message,
         category, priority, source_type, source_id, action_url,
         is_read, read_at, metadata, created_at
  FROM in_app_notifications
  WHERE tenant_id = $1::uuid
    AND is_deleted = FALSE
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
`;

const COUNT_SQL = `
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread
  FROM in_app_notifications
  WHERE tenant_id = $1::uuid
    AND is_deleted = FALSE
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
`;

const UNREAD_COUNT_SQL = `
  SELECT COUNT(*)::int AS unread
  FROM in_app_notifications
  WHERE tenant_id = $1::uuid
    AND is_read = FALSE
    AND is_deleted = FALSE
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
`;

const MARK_READ_SQL = `
  UPDATE in_app_notifications
  SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid
    AND notification_id = ANY($2::uuid[])
    AND is_read = FALSE
`;

const MARK_ALL_READ_SQL = `
  UPDATE in_app_notifications
  SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid
    AND is_read = FALSE
    AND is_deleted = FALSE
`;

/**
 * Create an in-app notification and push it to connected SSE clients.
 *
 * If `user_id` is specified, the notification is sent to that user only.
 * If `user_id` is null/undefined, the notification is broadcast to all
 * connected users in the tenant.
 */
export const createInAppNotification = async (input: CreateInAppNotification): Promise<unknown> => {
  const { rows } = await query(INSERT_SQL, [
    input.tenant_id,
    input.property_id ?? null,
    input.user_id ?? null,
    input.title,
    input.message,
    input.category ?? "info",
    input.priority ?? "normal",
    input.source_type ?? null,
    input.source_id ?? null,
    input.action_url ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.expires_at ?? null,
  ]);

  const notification = rows[0];
  if (!notification) {
    throw new Error("Failed to insert in-app notification");
  }

  // Push to connected SSE clients
  if (input.user_id) {
    sseManager.sendToUser(input.tenant_id, input.user_id, notification);
  } else {
    // Broadcast to all tenant users
    sseManager.broadcastToTenant(input.tenant_id, notification);
  }

  logger.info(
    {
      notificationId: notification.notification_id,
      tenantId: input.tenant_id,
      category: input.category,
      userId: input.user_id ?? "broadcast",
    },
    "In-app notification created",
  );

  return notification;
};

/**
 * List in-app notifications for a tenant with optional filters.
 */
export const listInAppNotifications = async (
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    category?: string;
    is_read?: string;
    priority?: string;
    userId?: string;
  } = {},
): Promise<{
  data: unknown[];
  meta: { total: number; unread: number; limit: number; offset: number };
}> => {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = Math.max(options.offset ?? 0, 0);

  // Build dynamic WHERE clauses
  const conditions: string[] = [];
  const params: unknown[] = [tenantId];
  let paramIndex = 2;

  if (options.userId) {
    conditions.push(`(user_id = $${paramIndex}::uuid OR user_id IS NULL)`);
    params.push(options.userId);
    paramIndex++;
  }
  if (options.category) {
    conditions.push(`category = $${paramIndex}`);
    params.push(options.category);
    paramIndex++;
  }
  if (options.is_read === "true") {
    conditions.push("is_read = TRUE");
  } else if (options.is_read === "false") {
    conditions.push("is_read = FALSE");
  }
  if (options.priority) {
    conditions.push(`priority = $${paramIndex}`);
    params.push(options.priority);
    paramIndex++;
  }

  const whereExtra = conditions.length > 0 ? ` AND ${conditions.join(" AND ")}` : "";

  // Count query
  const countResult = await query<{ total: number; unread: number }>(
    `${COUNT_SQL}${whereExtra}`,
    params,
  );
  const { total, unread } = countResult.rows[0] ?? { total: 0, unread: 0 };

  // Data query
  const listParams = [...params, limit, offset];
  const { rows } = await query(
    `${LIST_SQL}${whereExtra} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    listParams,
  );

  return { data: rows, meta: { total, unread, limit, offset } };
};

/**
 * Get unread notification count for a tenant (optionally user-scoped).
 */
export const getUnreadCount = async (tenantId: string, userId?: string): Promise<number> => {
  let sql = UNREAD_COUNT_SQL;
  const params: unknown[] = [tenantId];

  if (userId) {
    sql += " AND (user_id = $2::uuid OR user_id IS NULL)";
    params.push(userId);
  }

  const { rows } = await query<{ unread: number }>(sql, params);
  return rows[0]?.unread ?? 0;
};

/**
 * Mark specific notifications as read.
 */
export const markNotificationsRead = async (
  tenantId: string,
  notificationIds: string[],
): Promise<number> => {
  const result = await query(MARK_READ_SQL, [tenantId, notificationIds]);
  return result.rowCount ?? 0;
};

/**
 * Mark all notifications as read for a tenant.
 */
export const markAllNotificationsRead = async (tenantId: string): Promise<number> => {
  const result = await query(MARK_ALL_READ_SQL, [tenantId]);
  return result.rowCount ?? 0;
};
