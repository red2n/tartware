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
