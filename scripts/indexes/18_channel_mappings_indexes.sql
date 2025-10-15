-- =====================================================
-- 18_channel_mappings_indexes.sql
-- Indexes for channel_mappings table
-- Performance optimization for OTA integration queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for channel_mappings table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_channel_mappings_tenant_id ON channel_mappings(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_mappings_property_id ON channel_mappings(property_id) WHERE deleted_at IS NULL;

-- Channel lookup
CREATE INDEX IF NOT EXISTS idx_channel_mappings_channel_name ON channel_mappings(channel_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_mappings_channel_code ON channel_mappings(channel_code) WHERE deleted_at IS NULL;

-- Entity mapping
CREATE INDEX IF NOT EXISTS idx_channel_mappings_entity_type ON channel_mappings(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_mappings_entity_id ON channel_mappings(entity_id) WHERE deleted_at IS NULL;

-- External reference lookup (critical for sync)
CREATE INDEX IF NOT EXISTS idx_channel_mappings_external_id ON channel_mappings(external_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_mappings_external_code ON channel_mappings(external_code)
    WHERE external_code IS NOT NULL AND deleted_at IS NULL;

-- Composite for entity lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_channel_mappings_entity_lookup ON channel_mappings(property_id, entity_type, entity_id, deleted_at)
    WHERE deleted_at IS NULL;

-- Composite for external lookup (reverse mapping)
CREATE INDEX IF NOT EXISTS idx_channel_mappings_external_lookup ON channel_mappings(channel_code, external_id, deleted_at)
    WHERE deleted_at IS NULL;

-- Active mappings
CREATE INDEX IF NOT EXISTS idx_channel_mappings_is_active ON channel_mappings(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_mappings_property_active ON channel_mappings(property_id, is_active, deleted_at)
    WHERE deleted_at IS NULL;

-- Sync status tracking
CREATE INDEX IF NOT EXISTS idx_channel_mappings_last_sync ON channel_mappings(last_sync_at) WHERE last_sync_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_mappings_sync_status ON channel_mappings(last_sync_status)
    WHERE last_sync_status IS NOT NULL;

-- Failed syncs (for monitoring)
CREATE INDEX IF NOT EXISTS idx_channel_mappings_sync_error ON channel_mappings(last_sync_status, last_sync_at)
    WHERE last_sync_status = 'error' AND deleted_at IS NULL;

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_channel_mappings_config_gin ON channel_mappings USING GIN(mapping_config);
CREATE INDEX IF NOT EXISTS idx_channel_mappings_metadata_gin ON channel_mappings USING GIN(metadata);

-- Composite for channel entity mappings
CREATE INDEX IF NOT EXISTS idx_channel_mappings_channel_entity ON channel_mappings(channel_code, entity_type, is_active, deleted_at)
    WHERE deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_channel_mappings_created_at ON channel_mappings(created_at);
CREATE INDEX IF NOT EXISTS idx_channel_mappings_updated_at ON channel_mappings(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_channel_mappings_deleted_at ON channel_mappings(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Channel_mappings indexes created successfully!'
