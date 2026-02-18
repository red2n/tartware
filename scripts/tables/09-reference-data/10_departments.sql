-- =====================================================
-- 10_departments.sql
-- Configurable Department Lookup Table
-- Industry Standard: OPERA Cloud, Mews, Cloudbeds
-- Pattern: Universal department reference for user assignment,
--          charge routing, staff scheduling, and reporting
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- DEPARTMENTS TABLE
-- Property-level department definitions for organizational
-- structure, user assignment, and financial reporting
-- =====================================================

CREATE TABLE IF NOT EXISTS departments (
    -- Primary Key
    department_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique department identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                   -- FK tenants.id
    property_id UUID,                                          -- NULL = tenant-wide default

    -- Department Identification
    department_code VARCHAR(30) NOT NULL,                       -- Short code (e.g., 'FO', 'HSKP', 'FB')
    department_name VARCHAR(200) NOT NULL,                      -- Display name (e.g., 'Front Office')
    description TEXT,                                           -- Extended description

    -- Classification
    department_type VARCHAR(50) NOT NULL DEFAULT 'OPERATIONAL' CHECK (
        department_type IN (
            'REVENUE',          -- Revenue-generating (F&B, Spa, Rooms)
            'OPERATIONAL',      -- Day-to-day operations (Housekeeping, Maintenance)
            'ADMINISTRATIVE',   -- Back-office (Accounting, HR, Sales)
            'MANAGEMENT'        -- Executive / GM office
        )
    ),                                                          -- Department classification

    -- Hierarchy
    parent_department_id UUID,                                  -- FK departments.department_id for sub-departments

    -- Financial
    cost_center_code VARCHAR(30),                               -- GL cost center for expense allocation
    revenue_center_code VARCHAR(30),                            -- GL revenue center for income allocation

    -- Contact
    head_user_id UUID,                                          -- FK users.id — department head
    email VARCHAR(255),                                         -- Department email
    phone_extension VARCHAR(20),                                -- Internal phone extension

    -- Display & Ordering
    display_order INTEGER DEFAULT 0,                            -- Sort priority in UI listings
    color_code VARCHAR(7),                                      -- UI color for scheduling boards
    icon VARCHAR(50),                                           -- Icon identifier

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                    -- Whether department is active
    is_system BOOLEAN NOT NULL DEFAULT FALSE,                   -- System-seeded vs user-created

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::JSONB,                         -- Extensible metadata

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
    created_by UUID,                                               -- Creator
    updated_by UUID,                                               -- Last updater

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                              -- Soft delete flag
    deleted_at TIMESTAMP WITH TIME ZONE,                           -- Soft delete timestamp
    deleted_by UUID,                                               -- Soft delete actor

    -- Constraints
    CONSTRAINT uq_department_code UNIQUE (tenant_id, property_id, department_code)
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE departments IS 'Property-level department definitions for organizational structure, user assignment, and financial reporting';
COMMENT ON COLUMN departments.department_code IS 'Short identifier code (e.g., FO, HSKP, FB, SPA, MAINT)';
COMMENT ON COLUMN departments.department_type IS 'Classification: REVENUE, OPERATIONAL, ADMINISTRATIVE, MANAGEMENT';
COMMENT ON COLUMN departments.parent_department_id IS 'Self-referencing FK for sub-department hierarchy';
COMMENT ON COLUMN departments.cost_center_code IS 'GL cost center for expense allocation';
COMMENT ON COLUMN departments.revenue_center_code IS 'GL revenue center for income allocation';
COMMENT ON COLUMN departments.head_user_id IS 'Department head — FK to users.id';

-- =====================================================
-- SEED DEFAULT DEPARTMENTS
-- Standard PMS department structure covering all operational areas.
-- Uses ON CONFLICT to allow safe re-runs.
-- =====================================================

INSERT INTO departments (
    tenant_id, department_code, department_name, description, department_type,
    cost_center_code, revenue_center_code, display_order, is_system
)
SELECT * FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::UUID, 'FO',    'Front Office',    'Reception, check-in/out, concierge, bell services',     'REVENUE',        'CC-FO',   'RC-ROOMS',  10, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'HSKP',  'Housekeeping',    'Room cleaning, laundry, linen management',               'OPERATIONAL',    'CC-HSKP', NULL,        20, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'MAINT',  'Maintenance',    'Engineering, preventive maintenance, repairs',            'OPERATIONAL',    'CC-MAINT', NULL,       30, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'FB',     'Food & Beverage','Restaurants, bars, room service, banquets',               'REVENUE',        'CC-FB',   'RC-FB',     40, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'SPA',    'Spa & Wellness', 'Spa treatments, fitness center, pool',                   'REVENUE',        'CC-SPA',  'RC-SPA',    50, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'SALES',  'Sales',          'Group sales, corporate accounts, event coordination',     'ADMINISTRATIVE', 'CC-SALES', NULL,       60, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'ACCT',   'Accounting',     'Night audit, AR, AP, financial reporting',                'ADMINISTRATIVE', 'CC-ACCT', NULL,        70, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'HR',     'Human Resources','Staff scheduling, payroll, training',                     'ADMINISTRATIVE', 'CC-HR',   NULL,        80, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'SEC',    'Security',       'Guest safety, CCTV, access control, incident response',   'OPERATIONAL',    'CC-SEC',  NULL,        90, TRUE),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'GM',     'General Manager','Executive management and strategic oversight',            'MANAGEMENT',     'CC-GM',   NULL,       100, TRUE)
) AS t(tenant_id, department_code, department_name, description, department_type,
       cost_center_code, revenue_center_code, display_order, is_system)
ON CONFLICT ON CONSTRAINT uq_department_code DO NOTHING;

\echo 'departments table created successfully!'
