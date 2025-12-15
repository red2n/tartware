-- =====================================================
-- 53_reservation_event_offsets.sql
-- Tracks Kafka partition offsets + idempotency for reservation events
-- Pattern: Stateful consumer checkpoints for horizontal K8s/K3s scaling
-- Date: 2025-12-15
-- =====================================================

\c tartware \echo 'Creating reservation_event_offsets table...'

CREATE TABLE IF NOT EXISTS reservation_event_offsets (
    id BIGSERIAL PRIMARY KEY,
    consumer_group VARCHAR(150) NOT NULL,
    topic VARCHAR(200) NOT NULL,
    partition INT NOT NULL,
    last_processed_offset BIGINT NOT NULL,
    last_event_id UUID,
    reservation_id UUID,
    correlation_id UUID,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (consumer_group, topic, partition)
);

COMMENT ON TABLE reservation_event_offsets IS 'Kafka consumer checkpoints and idempotency markers for reservation event handlers';
COMMENT ON COLUMN reservation_event_offsets.consumer_group IS 'Kafka consumer group identifier (maps to Deployment/StatefulSet)';
COMMENT ON COLUMN reservation_event_offsets.last_processed_offset IS 'Highest committed offset for the partition';
COMMENT ON COLUMN reservation_event_offsets.correlation_id IS 'Event correlation identifier for idempotency checks';

CREATE INDEX IF NOT EXISTS idx_res_evt_offsets_reservation
    ON reservation_event_offsets (reservation_id)
    WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_res_evt_offsets_correlation
    ON reservation_event_offsets (correlation_id)
    WHERE correlation_id IS NOT NULL;

\echo 'reservation_event_offsets table created.'
