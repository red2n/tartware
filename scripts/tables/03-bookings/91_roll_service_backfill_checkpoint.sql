-- =====================================================
-- roll_service_backfill_checkpoint
-- Tracks replay progress per tenant (or global sentinel) for lifecycle backfills.
-- =====================================================

\c tartware

\echo 'Creating roll_service_backfill_checkpoint table...'

CREATE TABLE IF NOT EXISTS roll_service_backfill_checkpoint (
    tenant_id UUID PRIMARY KEY,                       -- Tenant ID; 00000000-...-000000 for global batches
    last_event_id UUID,                               -- UUID of the last replayed lifecycle event
    last_event_created_at TIMESTAMPTZ,                -- Timestamp of the last replayed event
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()     -- Last checkpoint update timestamp
);

COMMENT ON TABLE roll_service_backfill_checkpoint IS 'Backfill checkpoints so roll-service can resume lifecycle replays after restarts.';
COMMENT ON COLUMN roll_service_backfill_checkpoint.tenant_id IS 'Tenant identifier; use 00000000-0000-0000-0000-000000000000 for global batches.';
COMMENT ON COLUMN roll_service_backfill_checkpoint.last_event_id IS 'UUID of the last successfully replayed lifecycle event';
COMMENT ON COLUMN roll_service_backfill_checkpoint.last_event_created_at IS 'Timestamp of the last replayed event for ordering';

\echo 'roll_service_backfill_checkpoint table created successfully!'
