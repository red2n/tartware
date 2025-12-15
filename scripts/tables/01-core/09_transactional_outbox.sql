-- =====================================================
-- 09_transactional_outbox.sql
-- Transactional Outbox for reliable event delivery
-- Pattern: Transactional outbox + Kafka relay (Uber Cadence, Netflix Keystone)
-- Date: 2025-12-15
-- Notes: Designed for Kubernetes CronJobs/Deployments (K8s/K3s) with optimistic locking
-- =====================================================

\c tartware \echo 'Creating transactional_outbox table...'

CREATE TABLE IF NOT EXISTS transactional_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(120) NOT NULL,
    event_type VARCHAR(150) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    status outbox_status NOT NULL DEFAULT 'PENDING',
    priority SMALLINT NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(120),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    last_error TEXT,
    correlation_id UUID,
    partition_key VARCHAR(200),
    delivered_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT transactional_outbox_unique_event UNIQUE (event_id)
);

COMMENT ON TABLE transactional_outbox IS 'Durable event ledger flushed to Kafka via transactional outbox processor';
COMMENT ON COLUMN transactional_outbox.status IS 'Delivery lifecycle (PENDING, IN_PROGRESS, DELIVERED, FAILED, DLQ)';
COMMENT ON COLUMN transactional_outbox.locked_by IS 'Identifier for the worker pod/job holding this record';
COMMENT ON COLUMN transactional_outbox.partition_key IS 'Deterministic routing key for Kafka partition alignment';

CREATE INDEX IF NOT EXISTS idx_outbox_dispatch_ready
    ON transactional_outbox (available_at, priority)
    WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_outbox_tenant_status
    ON transactional_outbox (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_outbox_locked_workers
    ON transactional_outbox (locked_by)
    WHERE status = 'IN_PROGRESS';

\echo 'transactional_outbox table created.'
