-- =====================================================
-- 89_data_sync_status_indexes.sql
-- Data Sync Status Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating data_sync_status indexes...'

CREATE INDEX idx_data_sync_status_tenant ON data_sync_status(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_property ON data_sync_status(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_integration ON data_sync_status(integration_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_entity ON data_sync_status(entity_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_status ON data_sync_status(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_started ON data_sync_status(started_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_data_sync_status_next_sync ON data_sync_status(next_sync_at) WHERE status = 'completed' AND is_deleted = FALSE;

\echo 'Data Sync Status indexes created successfully!'
