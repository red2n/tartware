
-- =====================================================
-- push_notifications.sql
-- Push Notifications Table
-- Industry Standard: Mobile app engagement via push notifications
-- Pattern: Store and track push notification delivery to mobile devices
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- PUSH_NOTIFICATIONS TABLE
-- Mobile push notifications for guest engagement
-- =====================================================

CREATE TABLE IF NOT EXISTS push_notifications (
    -- Primary Key
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Recipient Configuration
    recipient_type VARCHAR(50) CHECK (recipient_type IN ('guest', 'staff', 'segment', 'broadcast')),
    recipient_id UUID,
    guest_id UUID,

    -- Notification Classification
    notification_type VARCHAR(100) CHECK (notification_type IN ('booking', 'checkin', 'checkout', 'promotion', 'alert', 'reminder', 'info')),

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    status VARCHAR(50) CHECK (status IN ('draft', 'scheduled', 'sent', 'delivered', 'opened', 'failed', 'cancelled')) DEFAULT 'draft',

    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,

    device_token VARCHAR(500),
    platform VARCHAR(50) CHECK (platform IN ('ios', 'android', 'web')),

    action_url TEXT,
    custom_data JSONB,

    priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


COMMENT ON TABLE push_notifications IS 'Manages push notifications for mobile apps';
COMMENT ON COLUMN push_notifications.notification_id IS 'Unique identifier for the push notification';
COMMENT ON COLUMN push_notifications.tenant_id IS 'Tenant sending the notification';
COMMENT ON COLUMN push_notifications.property_id IS 'Property context for the notification, if property-specific';
COMMENT ON COLUMN push_notifications.recipient_type IS 'Audience type: individual guest, staff member, segment, or broadcast';
COMMENT ON COLUMN push_notifications.recipient_id IS 'Identifier of the target recipient (user or segment ID)';
COMMENT ON COLUMN push_notifications.guest_id IS 'Guest receiving the notification, if guest-specific';
COMMENT ON COLUMN push_notifications.notification_type IS 'Category of notification (booking, checkin, checkout, promotion, alert, reminder, info)';
COMMENT ON COLUMN push_notifications.title IS 'Notification title displayed to the recipient';
COMMENT ON COLUMN push_notifications.message IS 'Notification body text';
COMMENT ON COLUMN push_notifications.status IS 'Delivery lifecycle status (draft, scheduled, sent, delivered, opened, failed, cancelled)';
COMMENT ON COLUMN push_notifications.scheduled_at IS 'Scheduled time for future delivery';
COMMENT ON COLUMN push_notifications.sent_at IS 'Timestamp when the notification was sent to the push service';
COMMENT ON COLUMN push_notifications.delivered_at IS 'Timestamp when the device confirmed delivery';
COMMENT ON COLUMN push_notifications.opened_at IS 'Timestamp when the recipient opened the notification';
COMMENT ON COLUMN push_notifications.device_token IS 'Push service device token for the target device';
COMMENT ON COLUMN push_notifications.platform IS 'Target platform (ios, android, web)';
COMMENT ON COLUMN push_notifications.action_url IS 'Deep-link or URL to open when the notification is tapped';
COMMENT ON COLUMN push_notifications.custom_data IS 'Additional key-value payload sent with the notification';
COMMENT ON COLUMN push_notifications.priority IS 'Delivery priority level (low, medium, high, urgent)';

\echo 'push_notifications table created successfully!'
