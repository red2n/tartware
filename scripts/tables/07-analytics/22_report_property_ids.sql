-- =====================================================
-- report_property_ids.sql
-- Report Property IDs Table
-- Industry Standard: Multi-property report filtering
-- Pattern: Many-to-Many Association for Reports
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating report_property_ids table...'

-- =====================================================
-- REPORT_PROPERTY_IDS TABLE
-- Link reports to specific properties
-- Support multi-property filtering
-- =====================================================

CREATE TABLE IF NOT EXISTS report_property_ids (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    report_id UUID NOT NULL,
    property_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT report_property_unique UNIQUE (report_id, property_id)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE report_property_ids IS 'Many-to-many: Reports to Properties';
COMMENT ON COLUMN report_property_ids.id IS 'Unique association identifier (UUID)';
COMMENT ON COLUMN report_property_ids.report_id IS 'Reference to analytics_reports.id';
COMMENT ON COLUMN report_property_ids.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN report_property_ids.tenant_id IS 'Reference to tenants.id';

\echo 'Report_property_ids table created successfully!'
\echo ''
\echo '============================================='
\echo 'ALL 22 TABLES CREATED SUCCESSFULLY!'
\echo '============================================='
