-- =====================================================
-- 113_in_app_notifications.sql
-- In-App Notifications Table
-- Industry Standard: Real-time staff notifications for PMS events
-- Pattern: Persisted notification feed with read/unread tracking
-- Date: 2026-03-03
-- =====================================================

-- =====================================================
-- IN_APP_NOTIFICATIONS TABLE
-- Real-time in-application notifications for staff users
-- =====================================================

CREATE TABLE IF NOT EXISTS in_app_notifications (
    -- Primary Key
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Unique notification identifier

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,            -- Owning tenant
    property_id UUID,                   -- Property context (NULL = tenant-wide)

    -- Recipient
    user_id UUID,                       -- Target staff user (NULL = broadcast to all staff)

    -- Notification Content
    title VARCHAR(255) NOT NULL,        -- Short display title
    message TEXT NOT NULL,              -- Notification body text
    category VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (category IN (
        'reservation', 'checkin', 'checkout', 'payment', 'housekeeping',
        'maintenance', 'rate', 'guest', 'system', 'info', 'alert'
    )),                                 -- Event category for filtering/icons
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN (
        'low', 'normal', 'high', 'urgent'
    )),                                 -- Display priority level

    -- Source Reference
    source_type VARCHAR(50),            -- Entity type that triggered this (e.g. 'reservation', 'payment')
    source_id UUID,                     -- ID of the source entity for deep-linking
    action_url VARCHAR(500),            -- Optional in-app route to navigate to

    -- Read Status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,   -- Whether the user has read this notification
    read_at TIMESTAMP WITH TIME ZONE,         -- When the user read it

    -- Metadata
    metadata JSONB,                     -- Additional context (event details, amounts, etc.)

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE, -- Auto-expire old notifications (NULL = never)

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ── Indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_tenant_user
    ON in_app_notifications (tenant_id, user_id, is_deleted, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread
    ON in_app_notifications (tenant_id, user_id, is_read, is_deleted)
    WHERE is_read = FALSE AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_property
    ON in_app_notifications (tenant_id, property_id, is_deleted, created_at DESC);

-- ── Comments ─────────────────────────────────────────
COMMENT ON TABLE in_app_notifications IS 'Real-time in-application notifications for PMS staff, tracking read/unread status per user';
COMMENT ON COLUMN in_app_notifications.notification_id IS 'Unique identifier for the notification';
COMMENT ON COLUMN in_app_notifications.tenant_id IS 'Tenant this notification belongs to';
COMMENT ON COLUMN in_app_notifications.property_id IS 'Property context; NULL means tenant-wide notification';
COMMENT ON COLUMN in_app_notifications.user_id IS 'Target staff user; NULL means broadcast to all staff in the property/tenant';
COMMENT ON COLUMN in_app_notifications.title IS 'Short title displayed in the notification bell dropdown';
COMMENT ON COLUMN in_app_notifications.message IS 'Notification body with event details';
COMMENT ON COLUMN in_app_notifications.category IS 'Event category used for icon and filter (reservation, checkin, checkout, payment, housekeeping, maintenance, rate, guest, system, info, alert)';
COMMENT ON COLUMN in_app_notifications.priority IS 'Display priority; urgent notifications trigger toast popups';
COMMENT ON COLUMN in_app_notifications.source_type IS 'Entity type that caused this notification (for deep-linking)';
COMMENT ON COLUMN in_app_notifications.source_id IS 'Entity ID of the source for navigation';
COMMENT ON COLUMN in_app_notifications.action_url IS 'In-app route to navigate to when notification is clicked';
COMMENT ON COLUMN in_app_notifications.is_read IS 'Whether the recipient has seen this notification';
COMMENT ON COLUMN in_app_notifications.read_at IS 'Timestamp when the notification was marked as read';
COMMENT ON COLUMN in_app_notifications.expires_at IS 'Optional expiration; expired notifications are hidden from feed';

\echo 'in_app_notifications table created successfully!'
