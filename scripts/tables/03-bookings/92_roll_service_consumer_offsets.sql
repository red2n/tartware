-- =====================================================
-- roll_service_consumer_offsets
-- Persists Kafka offsets per partition so shadow ingest can report/checkpoint progress.
-- =====================================================

\c tartware

\echo 'Creating roll_service_consumer_offsets table...'

CREATE TABLE IF NOT EXISTS roll_service_consumer_offsets (
    consumer_group TEXT NOT NULL,
    topic TEXT NOT NULL,
    partition INT NOT NULL,
    offset_position BIGINT NOT NULL,
    high_watermark BIGINT,
    last_event_id UUID,
    last_event_created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer_group, topic, partition)
);

COMMENT ON TABLE roll_service_consumer_offsets IS 'Mirror of the last committed Kafka offset per partition for observability and replay of the roll service shadow consumer.';

\echo '✓ roll_service_consumer_offsets created.'
