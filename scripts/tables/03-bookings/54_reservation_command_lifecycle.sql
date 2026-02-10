-- =====================================================
-- 54_reservation_command_lifecycle.sql
-- Tracks lifecycle checkpoints for reservation commands
-- Pattern: Guard rail metadata for asynchronous write pipeline
-- Date: 2025-12-23
-- =====================================================

\c tartware \echo 'Creating reservation_command_lifecycle table...'

CREATE TABLE IF NOT EXISTS reservation_command_lifecycle (
    event_id UUID PRIMARY KEY,                                                              -- Unique event/command identifier
    tenant_id UUID NOT NULL,                                                                -- FK tenants.id for data isolation
    reservation_id UUID,                                                                    -- FK reservations.id (NULL for pre-creation commands)
    command_name VARCHAR(150) NOT NULL,                                                     -- Command type (e.g., reservation.create)
    correlation_id VARCHAR(150),                                                            -- Cross-service correlation identifier
    partition_key VARCHAR(150),                                                             -- Kafka partition key used for ordering
    current_state reservation_command_lifecycle_state NOT NULL DEFAULT 'RECEIVED',           -- Latest lifecycle state
    state_transitions JSONB NOT NULL DEFAULT '[]'::jsonb,                                   -- Append-only array of state changes
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                                            -- Additional structured context
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                          -- Record creation timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                                           -- Last state change timestamp
);

COMMENT ON TABLE reservation_command_lifecycle IS 'Lifecycle guard rail for reservation commands (received → DLQ).';
COMMENT ON COLUMN reservation_command_lifecycle.current_state IS 'Latest lifecycle state (RECEIVED, PERSISTED, IN_PROGRESS, etc).';
COMMENT ON COLUMN reservation_command_lifecycle.state_transitions IS 'Append-only array capturing state, timestamp, and actor metadata.';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_res_cmd_lifecycle_tenant
    ON reservation_command_lifecycle (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_res_cmd_lifecycle_reservation
    ON reservation_command_lifecycle (reservation_id)
    WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_res_cmd_lifecycle_state
    ON reservation_command_lifecycle (current_state, updated_at DESC);

\echo 'reservation_command_lifecycle table created successfully!'
