-- =====================================================
-- 86_integration_mappings_indexes.sql
-- Integration Mappings Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating integration_mappings indexes...'

CREATE INDEX idx_integration_mappings_tenant ON integration_mappings(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_property ON integration_mappings(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_integration ON integration_mappings(integration_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_type ON integration_mappings(integration_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_active ON integration_mappings(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_sync ON integration_mappings(sync_frequency, next_sync_at) WHERE is_deleted = FALSE;

\echo 'Integration Mappings indexes created successfully!'
