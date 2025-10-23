
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
