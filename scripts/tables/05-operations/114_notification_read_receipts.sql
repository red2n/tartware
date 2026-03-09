-- =====================================================
-- 114_notification_read_receipts.sql
-- Per-User Read Receipts for Broadcast Notifications
-- Industry Standard: Individual read tracking for broadcast messages
-- Pattern: Junction table for per-user read state on shared notifications
-- Date: 2026-03-04
-- =====================================================

-- =====================================================
-- NOTIFICATION_READ_RECEIPTS TABLE
-- Tracks per-user read state for broadcast notifications
-- (where in_app_notifications.user_id IS NULL).
-- User-scoped notifications continue using the is_read
-- column on the in_app_notifications row itself.
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_read_receipts (
    -- Primary Key
    receipt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Unique receipt identifier

    -- References
    notification_id UUID NOT NULL,      -- FK to in_app_notifications.notification_id
    user_id UUID NOT NULL,              -- Staff user who read the broadcast notification
    tenant_id UUID NOT NULL,            -- Owning tenant (denormalized for partition/query efficiency)

    -- Read Timestamp
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- When the user read it

    -- Uniqueness: one receipt per user per notification
    CONSTRAINT uq_notification_read_receipts_notification_user UNIQUE (notification_id, user_id),

    -- Foreign Key
    CONSTRAINT fk_notification_read_receipts_notification
        FOREIGN KEY (notification_id) REFERENCES in_app_notifications (notification_id)
        ON DELETE CASCADE
);

-- ── Indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notification_read_receipts_tenant_user
    ON notification_read_receipts (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_notification_read_receipts_notification
    ON notification_read_receipts (notification_id);

-- ── Comments ─────────────────────────────────────────
COMMENT ON TABLE notification_read_receipts IS 'Per-user read receipts for broadcast notifications. Allows each user to independently mark shared notifications as read.';
COMMENT ON COLUMN notification_read_receipts.receipt_id IS 'Unique identifier for the read receipt';
COMMENT ON COLUMN notification_read_receipts.notification_id IS 'The broadcast notification that was read';
COMMENT ON COLUMN notification_read_receipts.user_id IS 'The staff user who read the notification';
COMMENT ON COLUMN notification_read_receipts.tenant_id IS 'Tenant this receipt belongs to (denormalized for efficient queries)';
COMMENT ON COLUMN notification_read_receipts.read_at IS 'Timestamp when the user marked the notification as read';

\echo 'notification_read_receipts table created successfully!'
