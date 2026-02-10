
-- =====================================================
-- app_usage_analytics.sql
-- App Usage Analytics Table
-- Industry Standard: Mobile app analytics and user behavior tracking
-- Pattern: Track mobile app usage, features, sessions for UX optimization
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- APP_USAGE_ANALYTICS TABLE
-- Mobile app usage tracking and analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS app_usage_analytics (
    -- Primary Key
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- User Identification
    guest_id UUID,
    session_id VARCHAR(255),
    device_id VARCHAR(255),

    platform VARCHAR(50) CHECK (platform IN ('ios', 'android', 'web')),
    app_version VARCHAR(50),
    os_version VARCHAR(50),

    event_type VARCHAR(100) CHECK (event_type IN ('app_open', 'app_close', 'screen_view', 'button_click', 'search', 'booking', 'feature_use')),
    event_name VARCHAR(255),
    screen_name VARCHAR(255),

    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    duration_seconds INTEGER,

    event_data JSONB,
    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    is_deleted BOOLEAN DEFAULT FALSE
);


COMMENT ON TABLE app_usage_analytics IS 'Tracks mobile app usage and user behavior analytics';
COMMENT ON COLUMN app_usage_analytics.event_id IS 'Unique identifier for the analytics event';
COMMENT ON COLUMN app_usage_analytics.tenant_id IS 'Tenant whose app generated the event';
COMMENT ON COLUMN app_usage_analytics.property_id IS 'Property context for the event, if applicable';
COMMENT ON COLUMN app_usage_analytics.guest_id IS 'Guest who triggered the event, if authenticated';
COMMENT ON COLUMN app_usage_analytics.session_id IS 'Unique session identifier grouping related events';
COMMENT ON COLUMN app_usage_analytics.device_id IS 'Device fingerprint or identifier';
COMMENT ON COLUMN app_usage_analytics.platform IS 'Platform where the event occurred (ios, android, web)';
COMMENT ON COLUMN app_usage_analytics.app_version IS 'Version of the mobile app that generated the event';
COMMENT ON COLUMN app_usage_analytics.os_version IS 'Operating system version on the device';
COMMENT ON COLUMN app_usage_analytics.event_type IS 'High-level event category (app_open, screen_view, booking, etc.)';
COMMENT ON COLUMN app_usage_analytics.event_name IS 'Specific event name for detailed tracking';
COMMENT ON COLUMN app_usage_analytics.screen_name IS 'App screen or page where the event was triggered';
COMMENT ON COLUMN app_usage_analytics.event_timestamp IS 'Exact time the event occurred on the device';
COMMENT ON COLUMN app_usage_analytics.duration_seconds IS 'Duration of the event or screen view in seconds';
COMMENT ON COLUMN app_usage_analytics.event_data IS 'Structured payload with event-specific details';

\echo 'app_usage_analytics table created successfully!'
