-- =====================================================
-- user_tenant_associations.sql
-- User-Tenant Association Table
-- Industry Standard: Many-to-many with RBAC
-- Pattern: Oracle OPERA Cloud, Cloudbeds Multi-property Access
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating user_tenant_associations table...'

-- =====================================================
-- USER_TENANT_ASSOCIATIONS TABLE
-- Many-to-many relationship: Users <-> Tenants
-- With role-based access control (RBAC)
-- Users can work for multiple tenants with different roles
-- =====================================================

CREATE TABLE IF NOT EXISTS user_tenant_associations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Role-Based Access Control
    role tenant_role NOT NULL DEFAULT 'STAFF',

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Access Control
    permissions JSONB DEFAULT '{
        "properties": [],
        "canAccessAll": false,
        "restrictions": {}
    }'::jsonb,

    -- Date Range (optional: for temporary access)
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT user_tenant_unique UNIQUE (user_id, tenant_id),
    CONSTRAINT valid_date_range CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE user_tenant_associations IS 'Many-to-many association between users and tenants with RBAC';
COMMENT ON COLUMN user_tenant_associations.id IS 'Unique association identifier (UUID)';
COMMENT ON COLUMN user_tenant_associations.user_id IS 'Reference to users.id';
COMMENT ON COLUMN user_tenant_associations.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN user_tenant_associations.role IS 'User role within this tenant (ENUM: super_admin, admin, manager, staff, guest)';
COMMENT ON COLUMN user_tenant_associations.permissions IS 'Fine-grained permissions (JSONB)';
COMMENT ON COLUMN user_tenant_associations.valid_from IS 'Access valid from date (optional)';
COMMENT ON COLUMN user_tenant_associations.valid_until IS 'Access valid until date (optional)';

\echo 'User_tenant_associations table created successfully!'
