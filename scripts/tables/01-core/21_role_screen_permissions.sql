-- =====================================================
-- 21_role_screen_permissions.sql
-- Role-based screen visibility configuration
-- Industry Standard: RBAC screen-level access control
-- Pattern: Configurable per-tenant, per-role navigation
-- Date: 2026-03-11
-- =====================================================

\echo 'Creating role_screen_permissions table...'

-- =====================================================
-- ROLE_SCREEN_PERMISSIONS TABLE
-- Controls which screens each role can access per tenant.
-- Admins configure via UI; fetched after login to filter
-- navigation and guard routes.
-- =====================================================

CREATE TABLE IF NOT EXISTS role_screen_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),          -- Unique row identifier
    tenant_id UUID NOT NULL REFERENCES tenants(id),          -- Tenant scope
    role tenant_role NOT NULL,                               -- Role this permission applies to
    screen_key VARCHAR(100) NOT NULL,                        -- Unique screen identifier (e.g. 'reservations', 'billing')
    is_visible BOOLEAN NOT NULL DEFAULT true,                -- Whether the screen is visible to this role
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Row creation timestamp
    updated_at TIMESTAMP,                                    -- Last modification timestamp
    created_by VARCHAR(100),                                 -- User who created the record
    updated_by VARCHAR(100),                                 -- User who last updated the record
    CONSTRAINT role_screen_unique UNIQUE (tenant_id, role, screen_key)
);

-- Index for fast lookups by tenant + role (the primary query pattern)
CREATE INDEX IF NOT EXISTS idx_role_screen_permissions_tenant_role
    ON role_screen_permissions (tenant_id, role);

COMMENT ON TABLE role_screen_permissions IS 'Per-tenant, per-role screen visibility configuration for RBAC navigation';
COMMENT ON COLUMN role_screen_permissions.tenant_id IS 'Tenant this permission belongs to';
COMMENT ON COLUMN role_screen_permissions.role IS 'Tenant role (OWNER, ADMIN, MANAGER, STAFF, VIEWER)';
COMMENT ON COLUMN role_screen_permissions.screen_key IS 'Unique screen identifier matching UI route keys';
COMMENT ON COLUMN role_screen_permissions.is_visible IS 'Whether the screen is visible to users with this role';

\echo 'role_screen_permissions table created successfully!'
