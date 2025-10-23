-- =====================================================
-- 44_ota_inventory_sync_indexes.sql
-- OTA Inventory Sync Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating ota_inventory_sync indexes...'

-- =====================================================
-- BASIC INDEXES
-- =====================================================

-- Multi-tenancy indexes
CREATE INDEX idx_ota_inventory_sync_tenant ON ota_inventory_sync(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_property ON ota_inventory_sync(property_id) WHERE is_deleted = FALSE;

-- Foreign key indexes
CREATE INDEX idx_ota_inventory_sync_ota_config ON ota_inventory_sync(ota_config_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_room_type ON ota_inventory_sync(room_type_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_rate_plan ON ota_inventory_sync(rate_plan_id) WHERE is_deleted = FALSE;

-- Status and type indexes
CREATE INDEX idx_ota_inventory_sync_status ON ota_inventory_sync(sync_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_type ON ota_inventory_sync(sync_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_channel ON ota_inventory_sync(channel_name) WHERE is_deleted = FALSE;

-- Timestamp indexes
CREATE INDEX idx_ota_inventory_sync_started_at ON ota_inventory_sync(sync_started_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_completed_at ON ota_inventory_sync(sync_completed_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_created_at ON ota_inventory_sync(created_at) WHERE is_deleted = FALSE;

-- Date range index
CREATE INDEX idx_ota_inventory_sync_date_range ON ota_inventory_sync(date_range_start, date_range_end) WHERE is_deleted = FALSE;

-- Batch processing indexes
CREATE INDEX idx_ota_inventory_sync_batch ON ota_inventory_sync(batch_id) WHERE is_deleted = FALSE;

-- Error tracking indexes
CREATE INDEX idx_ota_inventory_sync_retry ON ota_inventory_sync(next_retry_at) WHERE sync_status = 'failed' AND retry_count < max_retries AND is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_failed ON ota_inventory_sync(sync_status, error_code) WHERE sync_status = 'failed' AND is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_ota_inventory_sync_triggered_by ON ota_inventory_sync(triggered_by, triggered_by_user_id) WHERE is_deleted = FALSE;

-- =====================================================
-- JSONB GIN INDEXES
-- =====================================================

CREATE INDEX idx_ota_inventory_sync_metadata ON ota_inventory_sync USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_tags ON ota_inventory_sync USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_differences ON ota_inventory_sync USING gin(differences_detected) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_conflicts ON ota_inventory_sync USING gin(conflicts_found) WHERE is_deleted = FALSE;

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- =====================================================

CREATE INDEX idx_ota_inventory_sync_property_status ON ota_inventory_sync(property_id, sync_status, sync_started_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_channel_date ON ota_inventory_sync(channel_name, date_range_start, date_range_end) WHERE is_deleted = FALSE;
CREATE INDEX idx_ota_inventory_sync_tenant_channel ON ota_inventory_sync(tenant_id, channel_name, sync_started_at DESC) WHERE is_deleted = FALSE;

\echo 'OTA inventory sync indexes created successfully!'
