-- =====================================================
-- user_tenant_associations.sql
-- User-Tenant Association Table
-- Industry Standard: Many-to-many with RBAC
-- Pattern: Oracle OPERA Cloud, Cloudbeds Multi-property Access
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating user_tenant_associations table...'

-- =====================================================
-- USER_TENANT_ASSOCIATIONS TABLE
-- Many-to-many relationship: Users <-> Tenants
-- With role-based access control (RBAC)
-- Users can work for multiple tenants with different roles
-- =====================================================

CREATE TABLE IF NOT EXISTS user_tenant_associations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Association identity

-- Foreign Keys
user_id UUID NOT NULL, -- FK users.id
tenant_id UUID NOT NULL, -- FK tenants.id

-- Role-Based Access Control
role tenant_role NOT NULL DEFAULT 'STAFF', -- Role determines default permission bundle

-- Status
is_active BOOLEAN NOT NULL DEFAULT true, -- Allows revoking access without deleting association

-- Access Control
permissions JSONB DEFAULT '{
        "properties": [],
        "canAccessAll": false,
        "restrictions": {}
    }'::jsonb, -- Optional overrides for property-level access

-- Department Assignment
department_id UUID, -- FK departments.department_id — primary department for this tenant

-- Module Access (which modules user can access for this tenant)
modules JSONB DEFAULT '["core"]'::jsonb, -- Enabled modules: core, reservations, housekeeping, billing, etc.

-- Date Range (optional: for temporary access)
valid_from TIMESTAMP, -- When access becomes active
valid_until TIMESTAMP, -- When access expires

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Free-form extensions for integrations

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Association creation timestamp
updated_at TIMESTAMP, -- Last modification timestamp
created_by VARCHAR(100), -- Creator identifier
updated_by VARCHAR(100), -- Modifier identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Soft delete timestamp
deleted_by VARCHAR(100), -- Soft delete actor

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Version counter for concurrency control

-- Constraints
CONSTRAINT user_tenant_unique UNIQUE (user_id, tenant_id), -- Prevent duplicate associations
    CONSTRAINT valid_date_range CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until) -- Ensure valid temporal range
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

-- Idempotent column additions for existing tables
ALTER TABLE user_tenant_associations ADD COLUMN IF NOT EXISTS department_id UUID;

\echo 'User_tenant_associations table created successfully!'
