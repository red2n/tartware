-- =====================================================
-- 23_analytics_reports_fk.sql
-- Foreign Key Constraints for analytics_reports table
--
-- Relationships: tenant, property, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE analytics_reports DROP CONSTRAINT IF EXISTS fk_analytics_reports_tenant;
ALTER TABLE analytics_reports DROP CONSTRAINT IF EXISTS fk_analytics_reports_property;
ALTER TABLE analytics_reports DROP CONSTRAINT IF EXISTS fk_analytics_reports_created_by;
ALTER TABLE analytics_reports DROP CONSTRAINT IF EXISTS fk_analytics_reports_updated_by;
ALTER TABLE analytics_reports DROP CONSTRAINT IF EXISTS fk_analytics_reports_generated_by;

-- Tenant reference (required)
ALTER TABLE analytics_reports
    ADD CONSTRAINT fk_analytics_reports_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_reports_tenant ON analytics_reports IS 'Reports belong to a tenant';

-- Created by user (UUID column)
ALTER TABLE analytics_reports
    ADD CONSTRAINT fk_analytics_reports_created_by_user
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_reports_created_by_user ON analytics_reports IS 'User who created this report definition';

-- Note: analytics_reports does not have property_id
-- Note: created_by, updated_by, deleted_by are VARCHAR fields (usernames), not UUIDs

-- Success message
\echo '✓ Constraints created: analytics_reports (23/37)'
\echo '  - 5 foreign key constraints'
\echo ''
