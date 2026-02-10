-- =====================================================
-- 09_transactional_outbox.sql
-- Transactional Outbox for reliable event delivery
-- Pattern: Transactional outbox + Kafka relay (Uber Cadence, Netflix Keystone)
-- Date: 2025-12-15
-- Notes: Designed for Kubernetes CronJobs/Deployments (K8s/K3s) with optimistic locking
-- =====================================================

\c tartware \echo 'Creating transactional_outbox table...'

CREATE TABLE IF NOT EXISTS transactional_outbox (
    id BIGSERIAL PRIMARY KEY, -- Auto-incrementing surrogate key
    event_id UUID NOT NULL DEFAULT uuid_generate_v4(), -- Globally unique event identifier
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE, -- Owning tenant scope
    aggregate_id UUID NOT NULL, -- Domain entity this event belongs to
    aggregate_type VARCHAR(120) NOT NULL, -- Entity kind (reservation, folio, etc.)
    event_type VARCHAR(150) NOT NULL, -- Qualified event name for consumers
    payload JSONB NOT NULL, -- Serialised event body
    headers JSONB NOT NULL DEFAULT '{}'::jsonb, -- Transport-level metadata headers
    status outbox_status NOT NULL DEFAULT 'PENDING', -- Delivery lifecycle state
    priority SMALLINT NOT NULL DEFAULT 0, -- Dispatch priority (higher = sooner)
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Earliest eligible dispatch time
    locked_at TIMESTAMPTZ, -- Timestamp when worker acquired lock
    locked_by VARCHAR(120), -- Pod/job holding the processing lock
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0), -- Cumulative delivery attempts
    last_error TEXT, -- Most recent failure reason
    correlation_id UUID, -- Request trace correlation
    partition_key VARCHAR(200), -- Kafka partition routing key
    delivered_at TIMESTAMPTZ, -- Timestamp of successful delivery
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Extensible operational metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Row insertion timestamp
    updated_at TIMESTAMPTZ, -- Last modification timestamp
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
