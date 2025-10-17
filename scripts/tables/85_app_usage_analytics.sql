-- =====================================================
-- App Usage Analytics Table
-- =====================================================

CREATE TABLE IF NOT EXISTS app_usage_analytics (
    usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    guest_id UUID,
    user_id UUID,

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

CREATE INDEX idx_app_usage_analytics_tenant ON app_usage_analytics(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_property ON app_usage_analytics(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_guest ON app_usage_analytics(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_session ON app_usage_analytics(session_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_event_type ON app_usage_analytics(event_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_timestamp ON app_usage_analytics(event_timestamp DESC) WHERE is_deleted = FALSE;

COMMENT ON TABLE app_usage_analytics IS 'Tracks mobile app usage and user behavior analytics';
