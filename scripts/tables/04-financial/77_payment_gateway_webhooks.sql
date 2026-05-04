-- =====================================================
-- 77_payment_gateway_webhooks.sql
-- Payment Gateway Webhook Event Log Table
-- Industry Standard: PCI-DSS v4.0 Req 10 — log all payment-related events
-- Pattern: Idempotent inbound webhook log with dedup key + status state machine
-- Date: 2026-04-30
-- =====================================================

-- =====================================================
-- PAYMENT_GATEWAY_WEBHOOKS TABLE
-- Persists every inbound webhook event for idempotency,
-- audit, and replay. Dedup enforced by (tenant_id, gateway_provider, gateway_event_id).
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_gateway_webhooks (
    -- Primary Key
    webhook_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique webhook record

    -- Multi-tenancy
    tenant_id           UUID NOT NULL,          -- FK tenants.id
    property_id         UUID,                   -- NULL = tenant-wide

    -- Gateway Identification
    gateway_provider    VARCHAR(50)  NOT NULL,  -- STRIPE, ADYEN, SQUARE, WORLDPAY, etc.
    gateway_event_id    VARCHAR(250) NOT NULL,  -- Unique event ID sent by the gateway (dedup key)
    event_type          VARCHAR(100) NOT NULL,  -- Normalized event, e.g. payment.captured

    -- Processing State Machine
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED')), -- Lifecycle flag

    -- Payload & Error
    raw_payload         JSONB        NOT NULL,  -- Original webhook body (for replay)
    processing_error    TEXT,                   -- Error message when status = FAILED

    -- Timestamps
    received_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(), -- When POST was received
    processed_at        TIMESTAMPTZ,            -- When handler completed successfully
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Deduplication: one processed event per (tenant, gateway, event_id)
    CONSTRAINT uq_webhook_gateway_event
        UNIQUE (tenant_id, gateway_provider, gateway_event_id)
);

COMMENT ON TABLE payment_gateway_webhooks IS
    'Inbound webhook event log from payment gateways — idempotency key, state machine, raw payload for replay. PCI-DSS Req 10.';

COMMENT ON COLUMN payment_gateway_webhooks.gateway_event_id IS
    'Unique ID assigned by the gateway (e.g. evt_xxx from Stripe). Dedup key in UNIQUE constraint.';
COMMENT ON COLUMN payment_gateway_webhooks.status IS
    'State machine: PENDING → PROCESSED (success) | FAILED (error) | SKIPPED (duplicate or no-op).';
COMMENT ON COLUMN payment_gateway_webhooks.raw_payload IS
    'Full JSON body received from the gateway — retained for replay and PCI audit.';

-- ----------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_status
    ON payment_gateway_webhooks (tenant_id, status)
    WHERE status = 'PENDING';  -- Narrow index for pending-only queries

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_received
    ON payment_gateway_webhooks (tenant_id, received_at DESC);

\echo 'payment_gateway_webhooks table created successfully!'
