-- =====================================================
-- roll_service_backfill_checkpoint
-- Tracks replay progress per tenant (or global sentinel) for lifecycle backfills.
-- =====================================================

\c tartware

\echo 'Creating roll_service_backfill_checkpoint table...'

CREATE TABLE IF NOT EXISTS roll_service_backfill_checkpoint (
    tenant_id UUID PRIMARY KEY,
    last_event_id UUID,
    last_event_created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roll_service_backfill_checkpoint IS 'Backfill checkpoints so roll-service can resume lifecycle replays after restarts.';
COMMENT ON COLUMN roll_service_backfill_checkpoint.tenant_id IS 'Tenant identifier; use 00000000-0000-0000-0000-000000000000 for global batches.';

\echo '✓ roll_service_backfill_checkpoint created.'
