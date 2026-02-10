-- =====================================================
-- roll_service_consumer_offsets
-- Persists Kafka offsets per partition so shadow ingest can report/checkpoint progress.
-- =====================================================

\c tartware

\echo 'Creating roll_service_consumer_offsets table...'

CREATE TABLE IF NOT EXISTS roll_service_consumer_offsets (
    consumer_group TEXT NOT NULL,               -- Kafka consumer group identifier
    topic TEXT NOT NULL,                        -- Kafka topic name being consumed
    partition INT NOT NULL,                     -- Kafka partition number
    offset_position BIGINT NOT NULL,            -- Last committed offset for the partition
    high_watermark BIGINT,                      -- Partition high watermark for lag calculation
    last_event_id UUID,                         -- UUID of the most recently processed event
    last_event_created_at TIMESTAMPTZ,          -- Timestamp of the most recent event
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Last checkpoint timestamp
    PRIMARY KEY (consumer_group, topic, partition)
);

COMMENT ON TABLE roll_service_consumer_offsets IS 'Mirror of the last committed Kafka offset per partition for observability and replay of the roll service shadow consumer.';
COMMENT ON COLUMN roll_service_consumer_offsets.consumer_group IS 'Kafka consumer group identifier';
COMMENT ON COLUMN roll_service_consumer_offsets.offset_position IS 'Last committed offset for this partition';
COMMENT ON COLUMN roll_service_consumer_offsets.high_watermark IS 'Partition high watermark for consumer lag calculation';
COMMENT ON COLUMN roll_service_consumer_offsets.last_event_id IS 'UUID of the most recently processed lifecycle event';

\echo 'roll_service_consumer_offsets table created successfully!'
