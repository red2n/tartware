-- =====================================================
-- data_sync_status.sql
-- Data Sync Status Table
-- Industry Standard: Data synchronization tracking and monitoring
-- Pattern: Track data sync operations between systems
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- DATA_SYNC_STATUS TABLE
-- Data synchronization status and tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS data_sync_status (
    -- Primary Key
    sync_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Sync Configuration
    sync_name VARCHAR(200) NOT NULL,
    sync_type VARCHAR(100) CHECK (sync_type IN ('full', 'incremental', 'delta', 'realtime')) NOT NULL,

    -- Entity Information
    entity_type VARCHAR(100) NOT NULL,

    status VARCHAR(50) CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')) DEFAULT 'pending',

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    records_total INTEGER DEFAULT 0,
    records_processed INTEGER DEFAULT 0,
    records_succeeded INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,

    error_message TEXT,
    error_details JSONB,

    sync_config JSONB,
    sync_results JSONB,

    next_sync_at TIMESTAMP WITH TIME ZONE,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


COMMENT ON TABLE data_sync_status IS 'Tracks data synchronization status between integrated systems';
COMMENT ON COLUMN data_sync_status.sync_id IS 'Unique identifier for the sync operation';
COMMENT ON COLUMN data_sync_status.tenant_id IS 'Tenant owning this sync operation';
COMMENT ON COLUMN data_sync_status.property_id IS 'Property this sync pertains to';
COMMENT ON COLUMN data_sync_status.sync_name IS 'Human-readable name of the sync job';
COMMENT ON COLUMN data_sync_status.sync_type IS 'Type of synchronization (full, incremental, delta, realtime)';
COMMENT ON COLUMN data_sync_status.entity_type IS 'Type of entity being synchronized (e.g., reservations, guests, rates)';
COMMENT ON COLUMN data_sync_status.status IS 'Current status of the sync operation (pending, running, completed, failed, partial)';
COMMENT ON COLUMN data_sync_status.started_at IS 'Timestamp when the sync operation began';
COMMENT ON COLUMN data_sync_status.completed_at IS 'Timestamp when the sync operation finished';
COMMENT ON COLUMN data_sync_status.duration_seconds IS 'Total wall-clock duration of the sync in seconds';
COMMENT ON COLUMN data_sync_status.records_total IS 'Total number of records identified for synchronization';
COMMENT ON COLUMN data_sync_status.records_processed IS 'Number of records that have been processed so far';
COMMENT ON COLUMN data_sync_status.records_succeeded IS 'Number of records successfully synchronized';
COMMENT ON COLUMN data_sync_status.records_failed IS 'Number of records that failed to synchronize';
COMMENT ON COLUMN data_sync_status.records_skipped IS 'Number of records skipped (already up-to-date or filtered out)';
COMMENT ON COLUMN data_sync_status.error_message IS 'High-level error message if the sync failed';
COMMENT ON COLUMN data_sync_status.error_details IS 'Detailed error information including per-record failures';
COMMENT ON COLUMN data_sync_status.sync_config IS 'Configuration parameters used for this sync run';
COMMENT ON COLUMN data_sync_status.sync_results IS 'Summary results and statistics from the completed sync';
COMMENT ON COLUMN data_sync_status.next_sync_at IS 'Scheduled timestamp for the next sync operation';

\echo 'data_sync_status table created successfully!'
