-- =====================================================
-- Automated Messages Table
-- =====================================================
-- Purpose: Configuration for automated guest messaging workflows
-- Key Features:
--   - Trigger-based messaging
--   - Multi-channel delivery
--   - Template integration
--   - Performance tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS automated_messages (
    -- Primary Key
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Message Configuration
    message_name VARCHAR(200) NOT NULL,
    message_code VARCHAR(100) UNIQUE,
    description TEXT,

    -- Trigger Configuration
    trigger_type VARCHAR(100) NOT NULL CHECK (trigger_type IN (
        'booking_confirmed', 'booking_modified', 'booking_cancelled',
        'checkin_reminder', 'checkin_completed', 'checkout_reminder', 'checkout_completed',
        'payment_received', 'payment_failed', 'payment_reminder',
        'review_request', 'feedback_request',
        'birthday', 'anniversary', 'milestone',
        'promotion', 'special_offer', 'loyalty_points',
        'abandoned_cart', 'rate_change', 'availability_alert',
        'document_expiring', 'reservation_expiring',
        'pre_arrival', 'post_departure',
        'upsell_opportunity', 'cross_sell',
        'custom'
    )),
    trigger_event VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_paused BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 100,

    -- Timing Configuration
    send_timing VARCHAR(50) CHECK (send_timing IN ('immediate', 'scheduled', 'delayed', 'optimal_time')),
    delay_minutes INTEGER,
    delay_hours INTEGER,
    delay_days INTEGER,
    send_before_event_hours INTEGER,
    send_after_event_hours INTEGER,

    -- Scheduling
    scheduled_time TIME,
    scheduled_timezone VARCHAR(50),
    respect_quiet_hours BOOLEAN DEFAULT TRUE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,

    -- Template Reference
    template_id UUID,
    template_version INTEGER,
    fallback_template_id UUID,

    -- Channel Configuration
    message_channel VARCHAR(50) NOT NULL CHECK (message_channel IN ('email', 'sms', 'push', 'whatsapp', 'in_app', 'voice', 'webhook')),
    secondary_channels VARCHAR(50)[],
    channel_priority VARCHAR(50)[] DEFAULT ARRAY['email', 'sms', 'push'],

    -- Targeting & Conditions
    target_audience VARCHAR(100)[], -- ['all', 'new_guests', 'returning', 'vip', 'loyalty_members']
    guest_segments UUID[],
    conditions JSONB, -- {min_booking_value, room_types, rate_plans, etc}
    exclusion_conditions JSONB,

    -- Content Personalization
    use_guest_name BOOLEAN DEFAULT TRUE,
    use_property_name BOOLEAN DEFAULT TRUE,
    personalization_fields JSONB,
    dynamic_content_rules JSONB,

    -- Language & Localization
    default_language VARCHAR(10) DEFAULT 'en',
    multi_language BOOLEAN DEFAULT FALSE,
    language_detection_method VARCHAR(50) CHECK (language_detection_method IN ('guest_profile', 'property', 'browser', 'manual')),
    supported_languages VARCHAR(10)[],

    -- Frequency Control
    max_sends_per_guest_per_day INTEGER,
    max_sends_per_guest_per_week INTEGER,
    max_sends_per_guest_per_month INTEGER,
    min_hours_between_sends INTEGER,
    respect_unsubscribe BOOLEAN DEFAULT TRUE,
    respect_preferences BOOLEAN DEFAULT TRUE,

    -- A/B Testing
    is_ab_test BOOLEAN DEFAULT FALSE,
    ab_test_variant VARCHAR(50),
    ab_test_percentage INTEGER CHECK (ab_test_percentage BETWEEN 0 AND 100),
    ab_test_control_group_percentage INTEGER,

    -- Performance Tracking
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,

    -- Metrics
    delivery_rate DECIMAL(5,2),
    open_rate DECIMAL(5,2),
    click_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    unsubscribe_rate DECIMAL(5,2),

    -- Last Activity
    last_sent_at TIMESTAMP WITH TIME ZONE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,

    -- Error Handling
    retry_on_failure BOOLEAN DEFAULT TRUE,
    max_retry_attempts INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 15,

    -- Compliance
    requires_consent BOOLEAN DEFAULT FALSE,
    consent_type VARCHAR(100),
    gdpr_compliant BOOLEAN DEFAULT TRUE,
    include_unsubscribe_link BOOLEAN DEFAULT TRUE,

    -- Cost Tracking
    estimated_cost_per_send DECIMAL(10,4),
    total_cost DECIMAL(12,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes for automated_messages
CREATE INDEX idx_automated_messages_tenant ON automated_messages(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_property ON automated_messages(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_code ON automated_messages(message_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_trigger ON automated_messages(trigger_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_active ON automated_messages(is_active, is_paused) WHERE is_active = TRUE AND is_paused = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_priority ON automated_messages(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_template ON automated_messages(template_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_channel ON automated_messages(message_channel) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_last_sent ON automated_messages(last_sent_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_ab_test ON automated_messages(is_ab_test, ab_test_variant) WHERE is_ab_test = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_performance ON automated_messages(sent_count, open_rate, click_rate) WHERE sent_count > 0 AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_conditions ON automated_messages USING gin(conditions) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_metadata ON automated_messages USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_tags ON automated_messages USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_automated_messages_property_active ON automated_messages(property_id, is_active, trigger_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_trigger_active ON automated_messages(trigger_type, is_active, priority) WHERE is_active = TRUE AND is_paused = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_tenant_channel ON automated_messages(tenant_id, message_channel, is_active) WHERE is_deleted = FALSE;

-- Comments
COMMENT ON TABLE automated_messages IS 'Configuration for automated guest messaging workflows triggered by events';
COMMENT ON COLUMN automated_messages.trigger_type IS 'Event that triggers the automated message';
COMMENT ON COLUMN automated_messages.conditions IS 'JSON conditions that must be met for message to send';
COMMENT ON COLUMN automated_messages.channel_priority IS 'Ordered array of fallback channels if primary channel fails';
COMMENT ON COLUMN automated_messages.respect_quiet_hours IS 'If true, messages wont be sent during configured quiet hours';
