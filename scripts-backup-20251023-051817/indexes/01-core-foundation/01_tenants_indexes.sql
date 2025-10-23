-- =====================================================
-- 01_tenants_indexes.sql
-- Indexes for tenants table
-- Performance optimization for queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for tenants table...'

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_type ON tenants(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;

-- JSONB indexes for config searches
CREATE INDEX IF NOT EXISTS idx_tenants_config_gin ON tenants USING GIN(config);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_gin ON tenants USING GIN(subscription);

-- Active tenants filter (most common query)
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(status, deleted_at) WHERE deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);
CREATE INDEX IF NOT EXISTS idx_tenants_updated_at ON tenants(updated_at);

-- Soft delete index (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Tenants indexes created successfully!'
