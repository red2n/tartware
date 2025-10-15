-- =====================================================
-- 20_report_property_ids_fk.sql
-- Foreign Key Constraints for report_property_ids
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for report_property_ids...'

-- Foreign key to analytics_reports table
ALTER TABLE report_property_ids
ADD CONSTRAINT fk_report_property_ids_report_id
FOREIGN KEY (report_id)
REFERENCES analytics_reports(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE report_property_ids
ADD CONSTRAINT fk_report_property_ids_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to tenants table
ALTER TABLE report_property_ids
ADD CONSTRAINT fk_report_property_ids_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_report_property_ids_report_id ON report_property_ids IS
'Ensures report exists. RESTRICT prevents deleting reports with property associations.';

COMMENT ON CONSTRAINT fk_report_property_ids_property_id ON report_property_ids IS
'Ensures property exists. RESTRICT prevents deleting properties referenced in reports.';

COMMENT ON CONSTRAINT fk_report_property_ids_tenant_id ON report_property_ids IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with report property associations.';

\echo '✓ Report_property_ids foreign keys created successfully!'
