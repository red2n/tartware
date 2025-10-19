-- =====================================================
-- 03_user_tenant_associations_indexes.sql
-- Indexes for user_tenant_associations table
-- Performance optimization for RBAC queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for user_tenant_associations table...'

-- Foreign key indexes (critical for joins)
CREATE INDEX IF NOT EXISTS idx_uta_user_id ON user_tenant_associations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uta_tenant_id ON user_tenant_associations(tenant_id) WHERE deleted_at IS NULL;

-- Composite index for user-tenant lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_uta_user_tenant ON user_tenant_associations(user_id, tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- Role-based queries
CREATE INDEX IF NOT EXISTS idx_uta_role ON user_tenant_associations(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uta_tenant_role ON user_tenant_associations(tenant_id, role) WHERE deleted_at IS NULL AND is_active = true;

-- Active associations
CREATE INDEX IF NOT EXISTS idx_uta_is_active ON user_tenant_associations(is_active) WHERE deleted_at IS NULL;

-- Date range (for temporary access)
CREATE INDEX IF NOT EXISTS idx_uta_valid_from ON user_tenant_associations(valid_from) WHERE valid_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uta_valid_until ON user_tenant_associations(valid_until) WHERE valid_until IS NOT NULL;

-- JSONB index for permissions
CREATE INDEX IF NOT EXISTS idx_uta_permissions_gin ON user_tenant_associations USING GIN(permissions);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_uta_created_at ON user_tenant_associations(created_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_uta_deleted_at ON user_tenant_associations(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ User_tenant_associations indexes created successfully!'
