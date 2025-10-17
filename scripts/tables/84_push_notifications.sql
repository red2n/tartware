-- =====================================================
-- Push Notifications Table
-- =====================================================

CREATE TABLE IF NOT EXISTS push_notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    recipient_type VARCHAR(50) CHECK (recipient_type IN ('guest', 'staff', 'segment', 'broadcast')),
    recipient_id UUID,
    guest_id UUID,

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

CREATE INDEX idx_push_notifications_tenant ON push_notifications(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_property ON push_notifications(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_recipient ON push_notifications(recipient_type, recipient_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_guest ON push_notifications(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_push_notifications_status ON push_notifications(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_scheduled ON push_notifications(scheduled_at) WHERE status = 'scheduled' AND is_deleted = FALSE;

COMMENT ON TABLE push_notifications IS 'Manages push notifications for mobile apps';
