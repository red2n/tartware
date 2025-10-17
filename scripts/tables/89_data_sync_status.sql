-- =====================================================
-- Data Sync Status Table
-- =====================================================

CREATE TABLE IF NOT EXISTS data_sync_status (
    sync_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    sync_name VARCHAR(255) NOT NULL,
    integration_name VARCHAR(255) NOT NULL,

    sync_type VARCHAR(100) CHECK (sync_type IN ('full', 'incremental', 'delta')),
    sync_direction VARCHAR(50) CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),

    entity_type VARCHAR(255) NOT NULL,

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

CREATE INDEX idx_data_sync_status_tenant ON data_sync_status(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_property ON data_sync_status(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_integration ON data_sync_status(integration_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_entity ON data_sync_status(entity_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_status ON data_sync_status(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_started ON data_sync_status(started_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_next_sync ON data_sync_status(next_sync_at) WHERE status = 'completed' AND is_deleted = FALSE;

COMMENT ON TABLE data_sync_status IS 'Tracks data synchronization status between integrated systems';
