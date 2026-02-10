-- =====================================================
-- OTA Inventory Synchronization Table
-- =====================================================
-- Purpose: Track inventory sync status between PMS and OTA channels
-- Key Features:
--   - Real-time inventory synchronization
--   - Error tracking and retry logic
--   - Batch sync support
--   - Audit trail of all sync operations
-- =====================================================

CREATE TABLE IF NOT EXISTS ota_inventory_sync (
    -- Primary Key
    sync_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- OTA Configuration
    ota_config_id UUID NOT NULL,
    channel_name VARCHAR(100) NOT NULL,

    -- Sync Details
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'on_demand', 'scheduled', 'real_time')),
    sync_direction VARCHAR(20) NOT NULL CHECK (sync_direction IN ('push', 'pull', 'bidirectional')),
    sync_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed', 'partial', 'cancelled')),

    -- Affected Resources
    room_type_id UUID,
    rate_plan_id UUID,
    date_range_start DATE,
    date_range_end DATE,

    -- Inventory Data
    rooms_synced INTEGER DEFAULT 0,
    rates_synced INTEGER DEFAULT 0,
    restrictions_synced INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    successful_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,

    -- Timing
    sync_started_at TIMESTAMP WITH TIME ZONE,
    sync_completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Error Handling
    error_code VARCHAR(50),
    error_message TEXT,
    error_details JSONB,
    validation_errors JSONB,

    -- Request/Response
    request_payload JSONB,
    response_payload JSONB,
    http_status_code INTEGER,

    -- Batch Processing
    batch_id UUID,
    batch_sequence INTEGER,
    is_batch_complete BOOLEAN DEFAULT FALSE,

    -- Performance Metrics
    api_response_time_ms INTEGER,
    processing_time_ms INTEGER,
    items_per_second DECIMAL(10,2),

    -- Data Comparison
    differences_detected JSONB,
    conflicts_found JSONB,
    conflict_resolution VARCHAR(50) CHECK (conflict_resolution IN ('pms_wins', 'ota_wins', 'manual', 'latest_timestamp', 'ignore')),

    -- Audit Fields
    triggered_by VARCHAR(50) CHECK (triggered_by IN ('user', 'system', 'scheduler', 'webhook', 'api')),
    triggered_by_user_id UUID,
    sync_notes TEXT,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE ota_inventory_sync IS 'Tracks inventory synchronization operations between PMS and OTA channels';
COMMENT ON COLUMN ota_inventory_sync.sync_type IS 'Type of sync: full, incremental, on_demand, scheduled, real_time';
COMMENT ON COLUMN ota_inventory_sync.sync_direction IS 'Direction of sync: push (PMS to OTA), pull (OTA to PMS), bidirectional';
COMMENT ON COLUMN ota_inventory_sync.conflict_resolution IS 'Strategy for resolving data conflicts during sync';
COMMENT ON COLUMN ota_inventory_sync.differences_detected IS 'JSON structure tracking differences found during sync';

\echo 'ota_inventory_sync table created successfully!'
