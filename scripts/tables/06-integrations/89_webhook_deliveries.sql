-- ============================================================================
-- Table: webhook_deliveries
-- Purpose: Per-attempt delivery log for webhook_subscriptions. One row per
--          attempt, so retries are visible rather than overwriting each other.
-- Contract: Columns mirror WebhookDeliveryRow in @tartware/schemas — the
--           deliveries endpoint serialises with additionalProperties:false,
--           so any drift here silently blanks fields in the response.
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    -- Primary Key
    delivery_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,

    -- Owning subscription. Cascades so removing a subscription does not leave
    -- orphaned delivery rows behind.
    webhook_id UUID NOT NULL
        REFERENCES webhook_subscriptions (subscription_id) ON DELETE CASCADE,

    -- Delivery detail
    event_type VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('pending', 'delivered', 'failed')) DEFAULT 'pending',
    http_status_code INTEGER,
    attempt INTEGER DEFAULT 1,
    error_message TEXT,

    -- Body sent, retained for replay
    payload JSONB,

    duration_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- The deliveries endpoint always filters by subscription and orders by recency.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
    ON webhook_deliveries (webhook_id, created_at DESC);

-- Replay scans for failures within a tenant.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
    ON webhook_deliveries (tenant_id, status)
    WHERE status = 'failed';

COMMENT ON TABLE webhook_deliveries IS 'Per-attempt delivery log for webhook subscriptions';
COMMENT ON COLUMN webhook_deliveries.attempt IS 'Attempt number for this delivery, starting at 1';
COMMENT ON COLUMN webhook_deliveries.payload IS 'Body sent to the endpoint, retained so a delivery can be replayed';

\echo 'webhook_deliveries table created successfully!'
