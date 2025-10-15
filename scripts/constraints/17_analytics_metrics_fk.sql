-- =====================================================
-- 17_analytics_metrics_fk.sql
-- Foreign Key Constraints for analytics_metrics
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for analytics_metrics...'

-- Foreign key to tenants table
ALTER TABLE analytics_metrics
ADD CONSTRAINT fk_analytics_metrics_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table (nullable)
ALTER TABLE analytics_metrics
ADD CONSTRAINT fk_analytics_metrics_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to room_types table (nullable)
ALTER TABLE analytics_metrics
ADD CONSTRAINT fk_analytics_metrics_room_type_id
FOREIGN KEY (room_type_id)
REFERENCES room_types(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to rates table (nullable)
ALTER TABLE analytics_metrics
ADD CONSTRAINT fk_analytics_metrics_rate_id
FOREIGN KEY (rate_id)
REFERENCES rates(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_analytics_metrics_tenant_id ON analytics_metrics IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with analytics metrics (time-series data).';

COMMENT ON CONSTRAINT fk_analytics_metrics_property_id ON analytics_metrics IS
'Ensures property exists if specified. RESTRICT prevents deleting properties with metrics.';

COMMENT ON CONSTRAINT fk_analytics_metrics_room_type_id ON analytics_metrics IS
'Ensures room type exists if specified. RESTRICT prevents deleting room types with metrics.';

COMMENT ON CONSTRAINT fk_analytics_metrics_rate_id ON analytics_metrics IS
'Ensures rate exists if specified. RESTRICT prevents deleting rates with metrics.';

\echo '✓ Analytics_metrics foreign keys created successfully!'
