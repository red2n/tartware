/**
 * DEV DOC
 * Module: in-app-notification-repository.ts
 * Purpose: In-app notification rows: insert, list, unread counts and read receipts.
 *          Broadcast and user-scoped notifications need separate statements.
 * Ownership: notification-service
 *
 * Statements moved verbatim out of `services/in-app-notification-service.ts`.
 */

export const INSERT_SQL = `
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
export const LIST_SQL = `
  SELECT n.notification_id, n.tenant_id, n.property_id, n.user_id, n.title, n.message,
         n.category, n.priority, n.source_type, n.source_id, n.action_url,
         CASE
           WHEN n.user_id IS NOT NULL THEN n.is_read
           ELSE (nrr.receipt_id IS NOT NULL)
         END AS is_read,
         CASE
           WHEN n.user_id IS NOT NULL THEN n.read_at
           ELSE nrr.read_at
         END AS read_at,
         n.metadata, n.created_at
  FROM in_app_notifications n
  LEFT JOIN notification_read_receipts nrr
    ON n.notification_id = nrr.notification_id
    AND n.user_id IS NULL
    AND nrr.user_id = $2::uuid
  WHERE n.tenant_id = $1::uuid
    AND n.is_deleted = FALSE
    AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
`;
export const COUNT_SQL = `
  SELECT
    COUNT(n.notification_id)::int AS total,
    COUNT(n.notification_id) FILTER (WHERE
      CASE
        WHEN n.user_id IS NOT NULL THEN n.is_read = FALSE
        ELSE nrr.receipt_id IS NULL
      END
    )::int AS unread
  FROM in_app_notifications n
  LEFT JOIN notification_read_receipts nrr
    ON n.notification_id = nrr.notification_id
    AND n.user_id IS NULL
    AND nrr.user_id = $2::uuid
  WHERE n.tenant_id = $1::uuid
    AND n.is_deleted = FALSE
    AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
`;
export const UNREAD_COUNT_SQL = `
  SELECT COUNT(n.notification_id)::int AS unread
  FROM in_app_notifications n
  LEFT JOIN notification_read_receipts nrr
    ON n.notification_id = nrr.notification_id
    AND n.user_id IS NULL
    AND nrr.user_id = $2::uuid
  WHERE n.tenant_id = $1::uuid
    AND n.is_deleted = FALSE
    AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
    AND CASE
          WHEN n.user_id IS NOT NULL THEN n.is_read = FALSE
          ELSE nrr.receipt_id IS NULL
        END
`;
export const MARK_READ_USER_SCOPED_SQL = `
  UPDATE in_app_notifications
  SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid
    AND notification_id = ANY($2::uuid[])
    AND user_id = $3::uuid
    AND is_read = FALSE
    AND is_deleted = FALSE
`;
export const MARK_READ_BROADCAST_SQL = `
  INSERT INTO notification_read_receipts (notification_id, user_id, tenant_id)
  SELECT n.notification_id, $3::uuid, n.tenant_id
  FROM in_app_notifications n
  WHERE n.tenant_id = $1::uuid
    AND n.notification_id = ANY($2::uuid[])
    AND n.user_id IS NULL
    AND n.is_deleted = FALSE
  ON CONFLICT (tenant_id, notification_id, user_id) DO NOTHING
`;
export const MARK_ALL_READ_USER_SCOPED_SQL = `
  UPDATE in_app_notifications
  SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid
    AND user_id = $2::uuid
    AND is_read = FALSE
    AND is_deleted = FALSE
`;
export const MARK_ALL_READ_BROADCAST_SQL = `
  INSERT INTO notification_read_receipts (notification_id, user_id, tenant_id)
  SELECT n.notification_id, $2::uuid, n.tenant_id
  FROM in_app_notifications n
  LEFT JOIN notification_read_receipts nrr
    ON n.notification_id = nrr.notification_id AND nrr.user_id = $2::uuid
  WHERE n.tenant_id = $1::uuid
    AND n.user_id IS NULL
    AND n.is_deleted = FALSE
    AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
    AND nrr.receipt_id IS NULL
  ON CONFLICT (tenant_id, notification_id, user_id) DO NOTHING
`;
