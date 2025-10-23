-- =====================================================
-- 04_properties_indexes.sql
-- Indexes for properties table
-- Performance optimization for property queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for properties table...'

-- Foreign key index (critical for tenant queries)
CREATE INDEX IF NOT EXISTS idx_properties_tenant_id ON properties(tenant_id) WHERE deleted_at IS NULL;

-- Unique code lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_code ON properties(property_code) WHERE deleted_at IS NULL;

-- Name search (for autocomplete/search)
CREATE INDEX IF NOT EXISTS idx_properties_name ON properties(property_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_name_trgm ON properties USING gin(property_name gin_trgm_ops) WHERE deleted_at IS NULL;

-- Property type and status
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_is_active ON properties(is_active) WHERE deleted_at IS NULL;

-- Composite index for tenant properties (most common query)
CREATE INDEX IF NOT EXISTS idx_properties_tenant_active ON properties(tenant_id, is_active, deleted_at) WHERE deleted_at IS NULL;

-- Star rating (for filtering)
CREATE INDEX IF NOT EXISTS idx_properties_star_rating ON properties(star_rating) WHERE deleted_at IS NULL;

-- Location search (for geo queries)
CREATE INDEX IF NOT EXISTS idx_properties_address_gin ON properties USING GIN(address);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_properties_config_gin ON properties USING GIN(config);
CREATE INDEX IF NOT EXISTS idx_properties_integrations_gin ON properties USING GIN(integrations);

-- Currency and timezone (for reporting)
CREATE INDEX IF NOT EXISTS idx_properties_currency ON properties(currency);
CREATE INDEX IF NOT EXISTS idx_properties_timezone ON properties(timezone);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at);
CREATE INDEX IF NOT EXISTS idx_properties_updated_at ON properties(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_properties_deleted_at ON properties(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Properties indexes created successfully!'
