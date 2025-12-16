-- =====================================================
-- 10_reservation_lifecycle_events.sql
-- Lifecycle Guard Ledger for Reservation Commands
-- Pattern: Checkpoint ledger referenced by API, outbox dispatcher, and Kafka consumers
-- Date: 2025-12-15
-- Notes: Enables "where is my request?" observability plus stalled flow auditing (K8s/K3s friendly)
-- =====================================================

\c tartware \echo 'Creating reservation_lifecycle_events table...'

CREATE TABLE IF NOT EXISTS reservation_lifecycle_events (
    id BIGSERIAL PRIMARY KEY,
    correlation_id UUID NOT NULL,
    reservation_id UUID,
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    state reservation_lifecycle_state NOT NULL,
    checkpoint_source VARCHAR(150) NOT NULL,
    checkpoint_actor VARCHAR(150),
    checkpoint_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    checkpointed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reservation_lifecycle_events IS 'Request lifecycle ledger for reservation commands (RECEIVED→DLQ).';
COMMENT ON COLUMN reservation_lifecycle_events.checkpoint_source IS 'Component emitting the checkpoint (api, outbox, consumer, dlq worker).';
COMMENT ON COLUMN reservation_lifecycle_events.state IS 'Lifecycle guard state enforced by reliability policy.';

CREATE INDEX IF NOT EXISTS idx_lifecycle_correlation
    ON reservation_lifecycle_events (correlation_id, checkpointed_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_reservation
    ON reservation_lifecycle_events (reservation_id)
    WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lifecycle_state_age
    ON reservation_lifecycle_events (state, checkpointed_at);

CREATE INDEX IF NOT EXISTS idx_lifecycle_tenant_state
    ON reservation_lifecycle_events (tenant_id, state);

\echo 'reservation_lifecycle_events table created.'
