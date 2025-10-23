
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
