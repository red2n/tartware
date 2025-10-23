-- =====================================================
-- 18_analytics_metric_dimensions_fk.sql
-- Foreign Key Constraints for analytics_metric_dimensions
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for analytics_metric_dimensions...'

-- Foreign key to analytics_metrics table
ALTER TABLE analytics_metric_dimensions
ADD CONSTRAINT fk_analytics_metric_dimensions_metric_id
FOREIGN KEY (metric_id)
REFERENCES analytics_metrics(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to tenants table
ALTER TABLE analytics_metric_dimensions
ADD CONSTRAINT fk_analytics_metric_dimensions_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metric_dimensions_metric_id ON analytics_metric_dimensions IS
'Ensures metric exists. RESTRICT prevents deleting metrics with dimensions (dimensional data integrity).';

COMMENT ON CONSTRAINT fk_analytics_metric_dimensions_tenant_id ON analytics_metric_dimensions IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with metric dimensions.';

\echo '✓ Analytics_metric_dimensions foreign keys created successfully!'
