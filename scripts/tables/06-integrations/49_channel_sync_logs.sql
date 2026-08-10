-- =====================================================
-- 49_channel_sync_logs.sql
-- Per-run log of channel/OTA sync attempts
-- Read by the night audit to report what failed overnight.
-- Must follow 18_channel_mappings.sql, which it references.
-- Date: 2026-08-10
-- =====================================================

\echo 'Creating channel_sync_logs table...'

CREATE TABLE IF NOT EXISTS channel_sync_logs (
    sync_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id),
    property_id UUID,

    channel_mapping_id UUID REFERENCES channel_mappings (id) ON DELETE CASCADE,
    channel_name VARCHAR(100),

    -- inventory | rates | restrictions | reservations
    sync_type VARCHAR(50) NOT NULL,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'running',

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    records_processed INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,
    -- Who or what started the run: a user id, 'scheduler', or 'night-audit'.
    triggered_by VARCHAR(100),

    payload JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT channel_sync_logs_status_check
        CHECK (sync_status IN ('running', 'succeeded', 'failed', 'partial'))
);

-- The night-audit query: latest runs for one mapping, newest first.
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_mapping
    ON channel_sync_logs (channel_mapping_id, started_at DESC);
-- Failure sweeps across a tenant.
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_failed
    ON channel_sync_logs (tenant_id, sync_status) WHERE sync_status = 'failed';

COMMENT ON TABLE channel_sync_logs IS 'Per-run log of channel/OTA sync attempts; one row per run, read by the night audit';
COMMENT ON COLUMN channel_sync_logs.triggered_by IS 'User id, or scheduler/night-audit for automated runs';

-- Direction and created-count, read by the night-audit channel sync report.
ALTER TABLE channel_sync_logs ADD COLUMN IF NOT EXISTS sync_direction VARCHAR(20);
ALTER TABLE channel_sync_logs ADD COLUMN IF NOT EXISTS records_created INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN channel_sync_logs.sync_direction IS 'inbound (channel -> PMS) or outbound (PMS -> channel)';
COMMENT ON COLUMN channel_sync_logs.records_created IS 'Rows created by the run, as distinct from records_updated';

\echo 'channel_sync_logs table created successfully!'
