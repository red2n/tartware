-- =====================================================
-- 21_analytics_metrics_fk.sql
-- Foreign Key Constraints for analytics_metrics table
--
-- Relationships: tenant, property, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE analytics_metrics DROP CONSTRAINT IF EXISTS fk_analytics_metrics_tenant;
ALTER TABLE analytics_metrics DROP CONSTRAINT IF EXISTS fk_analytics_metrics_property;
ALTER TABLE analytics_metrics DROP CONSTRAINT IF EXISTS fk_analytics_metrics_created_by;
ALTER TABLE analytics_metrics DROP CONSTRAINT IF EXISTS fk_analytics_metrics_updated_by;

-- Tenant reference (required)
ALTER TABLE analytics_metrics
    ADD CONSTRAINT fk_analytics_metrics_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metrics_tenant ON analytics_metrics IS 'Analytics metrics belong to a tenant';

-- Property reference (optional - may be tenant-wide)
ALTER TABLE analytics_metrics
    ADD CONSTRAINT fk_analytics_metrics_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metrics_property ON analytics_metrics IS 'Analytics metrics may be property-specific';

-- Room type reference (optional)
ALTER TABLE analytics_metrics
    ADD CONSTRAINT fk_analytics_metrics_room_type
    FOREIGN KEY (room_type_id)
    REFERENCES room_types(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metrics_room_type ON analytics_metrics IS 'Analytics metrics may be room-type-specific';

-- Rate reference (optional)
ALTER TABLE analytics_metrics
    ADD CONSTRAINT fk_analytics_metrics_rate
    FOREIGN KEY (rate_id)
    REFERENCES rates(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metrics_rate ON analytics_metrics IS 'Analytics metrics may be rate-specific';

-- Note: analytics_metrics table does not have created_by/updated_by columns

-- Success message
\echo '✓ Constraints created: analytics_metrics (21/37)'
\echo '  - 4 foreign key constraints'
\echo ''
