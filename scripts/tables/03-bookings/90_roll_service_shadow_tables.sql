\c tartware \echo 'Creating roll_service shadow tables...'

-- =====================================================
-- roll_service_shadow_ledgers
-- Stores deterministic roll outcomes computed in shadow mode.
-- Idempotency enforced via (tenant_id, lifecycle_event_id) unique constraint.
-- =====================================================

CREATE TABLE IF NOT EXISTS roll_service_shadow_ledgers (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    reservation_id UUID,
    lifecycle_event_id UUID NOT NULL,
    roll_type VARCHAR(64) NOT NULL,
    roll_date DATE NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    source_event_type VARCHAR(150) NOT NULL,
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, lifecycle_event_id)
);

COMMENT ON TABLE roll_service_shadow_ledgers IS 'Shadow-mode ledger rows emitted by the roll service for parity validation.';
COMMENT ON COLUMN roll_service_shadow_ledgers.roll_type IS 'Derived roll classification (EOD, CHECKOUT, CANCEL, etc).';
COMMENT ON COLUMN roll_service_shadow_ledgers.event_payload IS 'Original lifecycle data used to compute the roll entry.';

CREATE INDEX IF NOT EXISTS idx_roll_shadow_ledger_reservation
    ON roll_service_shadow_ledgers (reservation_id);

CREATE INDEX IF NOT EXISTS idx_roll_shadow_ledger_roll_date
    ON roll_service_shadow_ledgers (roll_date, tenant_id);

-- =====================================================
-- roll_service_backfill_checkpoint
-- Tracks replay progress per tenant (or global sentinel) for lifecycle backfills.
-- =====================================================

CREATE TABLE IF NOT EXISTS roll_service_backfill_checkpoint (
    tenant_id UUID PRIMARY KEY,
    last_event_id UUID,
    last_event_created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roll_service_backfill_checkpoint IS 'Backfill checkpoints so roll-service can resume lifecycle replays after restarts.';
COMMENT ON COLUMN roll_service_backfill_checkpoint.tenant_id IS 'Tenant identifier; use 00000000-0000-0000-0000-000000000000 for global batches.';

-- =====================================================
-- roll_service_consumer_offsets
-- Persists Kafka offsets per partition so shadow ingest can report/checkpoint progress.
-- =====================================================

CREATE TABLE IF NOT EXISTS roll_service_consumer_offsets (
    consumer_group TEXT NOT NULL,
    topic TEXT NOT NULL,
    partition INT NOT NULL,
    offset BIGINT NOT NULL,
    high_watermark BIGINT,
    last_event_id UUID,
    last_event_created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer_group, topic, partition)
);

COMMENT ON TABLE roll_service_consumer_offsets IS 'Mirror of the last committed Kafka offset per partition for observability and replay of the roll service shadow consumer.';

\echo 'roll_service shadow tables created.'
