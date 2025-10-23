-- =====================================================
-- webhook_subscriptions.sql
-- Webhook Subscriptions Table
-- Industry Standard: Event-driven webhook notifications
-- Pattern: Subscribe to system events and receive webhook notifications
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- WEBHOOK_SUBSCRIPTIONS TABLE
-- Webhook subscriptions for event notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    -- Primary Key
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Webhook Configuration
    webhook_name VARCHAR(200) NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,

    -- Event Filtering
    event_types VARCHAR(100)[] NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    http_method VARCHAR(10) CHECK (http_method IN ('POST', 'PUT')) DEFAULT 'POST',
    headers JSONB,

    authentication_type VARCHAR(50) CHECK (authentication_type IN ('none', 'basic', 'bearer', 'api_key', 'oauth')),
    authentication_config JSONB,

    retry_count INTEGER DEFAULT 3,
    retry_backoff_seconds INTEGER DEFAULT 60,

    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,

    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


COMMENT ON TABLE webhook_subscriptions IS 'Manages webhook subscriptions for event notifications';
