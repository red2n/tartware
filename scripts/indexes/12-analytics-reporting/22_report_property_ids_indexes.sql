-- =====================================================
-- 22_report_property_ids_indexes.sql
-- Indexes for report_property_ids table
-- Performance optimization for report filtering queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for report_property_ids table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_report_property_ids_report_id ON report_property_ids(report_id);
CREATE INDEX IF NOT EXISTS idx_report_property_ids_property_id ON report_property_ids(property_id);
CREATE INDEX IF NOT EXISTS idx_report_property_ids_tenant_id ON report_property_ids(tenant_id);

-- Composite for report properties (most common query)
CREATE INDEX IF NOT EXISTS idx_report_property_ids_report_props ON report_property_ids(report_id, property_id);

-- Reverse lookup (properties to reports)
CREATE INDEX IF NOT EXISTS idx_report_property_ids_property_reports ON report_property_ids(property_id, report_id);

-- Audit trail index
CREATE INDEX IF NOT EXISTS idx_report_property_ids_created_at ON report_property_ids(created_at);

\echo '✓ Report_property_ids indexes created successfully!'
\echo ''
\echo '============================================='
\echo 'ALL 22 INDEX FILES CREATED SUCCESSFULLY!'
\echo '============================================='
