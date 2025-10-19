-- =====================================================
-- 19_analytics_reports_fk.sql
-- Foreign Key Constraints for analytics_reports
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for analytics_reports...'

-- Foreign key to tenants table
ALTER TABLE analytics_reports
ADD CONSTRAINT fk_analytics_reports_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to users table (nullable, created_by_user_id)
ALTER TABLE analytics_reports
ADD CONSTRAINT fk_analytics_reports_created_by_user_id
FOREIGN KEY (created_by_user_id)
REFERENCES users(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_reports_tenant_id ON analytics_reports IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with analytics reports.';

COMMENT ON CONSTRAINT fk_analytics_reports_created_by_user_id ON analytics_reports IS
'Ensures user exists if specified. RESTRICT prevents deleting users who created reports.';

\echo '✓ Analytics_reports foreign keys created successfully!'
