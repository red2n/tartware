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
COMMENT ON COLUMN webhook_subscriptions.subscription_id IS 'Unique identifier for the webhook subscription';
COMMENT ON COLUMN webhook_subscriptions.tenant_id IS 'Tenant owning this webhook subscription';
COMMENT ON COLUMN webhook_subscriptions.property_id IS 'Property this webhook is scoped to, NULL for tenant-wide';
COMMENT ON COLUMN webhook_subscriptions.webhook_name IS 'Human-readable name describing the webhook purpose';
COMMENT ON COLUMN webhook_subscriptions.webhook_url IS 'Destination URL where event payloads are delivered';
COMMENT ON COLUMN webhook_subscriptions.event_types IS 'Array of event types this webhook subscribes to';
COMMENT ON COLUMN webhook_subscriptions.is_active IS 'Whether this webhook subscription is currently active';
COMMENT ON COLUMN webhook_subscriptions.http_method IS 'HTTP method used when delivering the webhook (POST or PUT)';
COMMENT ON COLUMN webhook_subscriptions.headers IS 'Custom HTTP headers included with each webhook delivery';
COMMENT ON COLUMN webhook_subscriptions.authentication_type IS 'Authentication method for webhook delivery (none, basic, bearer, api_key, oauth)';
COMMENT ON COLUMN webhook_subscriptions.authentication_config IS 'Encrypted authentication credentials and configuration';
COMMENT ON COLUMN webhook_subscriptions.retry_count IS 'Maximum number of delivery retry attempts on failure';
COMMENT ON COLUMN webhook_subscriptions.retry_backoff_seconds IS 'Seconds to wait between retry attempts';
COMMENT ON COLUMN webhook_subscriptions.last_triggered_at IS 'Timestamp of the most recent webhook delivery attempt';
COMMENT ON COLUMN webhook_subscriptions.last_success_at IS 'Timestamp of the most recent successful delivery';
COMMENT ON COLUMN webhook_subscriptions.last_failure_at IS 'Timestamp of the most recent failed delivery';
COMMENT ON COLUMN webhook_subscriptions.success_count IS 'Total number of successful webhook deliveries';
COMMENT ON COLUMN webhook_subscriptions.failure_count IS 'Total number of failed webhook deliveries';

\echo 'webhook_subscriptions table created successfully!'
