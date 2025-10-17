-- =====================================================
-- Webhook Subscriptions Table
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    webhook_name VARCHAR(255) NOT NULL,
    webhook_url TEXT NOT NULL,

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

CREATE INDEX idx_webhook_subscriptions_tenant ON webhook_subscriptions(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_webhook_subscriptions_property ON webhook_subscriptions(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_webhook_subscriptions_active ON webhook_subscriptions(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_webhook_subscriptions_events ON webhook_subscriptions USING gin(event_types) WHERE is_deleted = FALSE;

COMMENT ON TABLE webhook_subscriptions IS 'Manages webhook subscriptions for event notifications';
