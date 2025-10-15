-- =====================================================
-- 22_analytics_metric_dimensions_fk.sql
-- Foreign Key Constraints for analytics_metric_dimensions table
--
-- Relationships: tenant, property, metric, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE analytics_metric_dimensions DROP CONSTRAINT IF EXISTS fk_analytics_metric_dimensions_tenant;
ALTER TABLE analytics_metric_dimensions DROP CONSTRAINT IF EXISTS fk_analytics_metric_dimensions_property;
ALTER TABLE analytics_metric_dimensions DROP CONSTRAINT IF EXISTS fk_analytics_metric_dimensions_metric;
ALTER TABLE analytics_metric_dimensions DROP CONSTRAINT IF EXISTS fk_analytics_metric_dimensions_created_by;
ALTER TABLE analytics_metric_dimensions DROP CONSTRAINT IF EXISTS fk_analytics_metric_dimensions_updated_by;

-- Tenant reference (required)
ALTER TABLE analytics_metric_dimensions
    ADD CONSTRAINT fk_analytics_metric_dimensions_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metric_dimensions_tenant ON analytics_metric_dimensions IS 'Metric dimensions belong to a tenant';

-- Property reference (optional)
ALTER TABLE analytics_metric_dimensions
    ADD CONSTRAINT fk_analytics_metric_dimensions_property
    FOREIGN KEY (property_id)
    REFERENCES properties(property_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metric_dimensions_property ON analytics_metric_dimensions IS 'Metric dimensions may be property-specific';

-- Metric reference (required)
ALTER TABLE analytics_metric_dimensions
    ADD CONSTRAINT fk_analytics_metric_dimensions_metric
    FOREIGN KEY (metric_id)
    REFERENCES analytics_metrics(metric_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metric_dimensions_metric ON analytics_metric_dimensions IS 'Dimensions belong to a metric';

-- Created by user
ALTER TABLE analytics_metric_dimensions
    ADD CONSTRAINT fk_analytics_metric_dimensions_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE analytics_metric_dimensions
    ADD CONSTRAINT fk_analytics_metric_dimensions_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: analytics_metric_dimensions (22/37)'
\echo '  - 5 foreign key constraints'
\echo ''
