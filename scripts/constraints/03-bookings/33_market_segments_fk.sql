-- =====================================================
-- 33_market_segments_fk.sql
-- Foreign Key Constraints for market_segments table
--
-- Relationships: tenant, property, parent_segment,
--                default_rate_plan, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE market_segments DROP CONSTRAINT IF EXISTS fk_market_segments_tenant;
ALTER TABLE market_segments DROP CONSTRAINT IF EXISTS fk_market_segments_property;
ALTER TABLE market_segments DROP CONSTRAINT IF EXISTS fk_market_segments_parent;
ALTER TABLE market_segments DROP CONSTRAINT IF EXISTS fk_market_segments_rate_plan;
ALTER TABLE market_segments DROP CONSTRAINT IF EXISTS fk_market_segments_created_by;
ALTER TABLE market_segments DROP CONSTRAINT IF EXISTS fk_market_segments_updated_by;
ALTER TABLE market_segments DROP CONSTRAINT IF EXISTS fk_market_segments_deleted_by;

-- Tenant reference (required)
ALTER TABLE market_segments
    ADD CONSTRAINT fk_market_segments_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_market_segments_tenant ON market_segments IS 'Market segments belong to a tenant';

-- Property reference (optional - may be tenant-wide)
ALTER TABLE market_segments
    ADD CONSTRAINT fk_market_segments_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_market_segments_property ON market_segments IS 'Market segments may be property-specific';

-- Parent segment (self-referential for hierarchy)
ALTER TABLE market_segments
    ADD CONSTRAINT fk_market_segments_parent
    FOREIGN KEY (parent_segment_id)
    REFERENCES market_segments(segment_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_market_segments_parent ON market_segments IS 'Parent segment for hierarchical structure';

-- Default rate plan reference (optional)
ALTER TABLE market_segments
    ADD CONSTRAINT fk_market_segments_rate_plan
    FOREIGN KEY (default_rate_plan_id)
    REFERENCES rates(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_market_segments_rate_plan ON market_segments IS 'Default rate plan for this segment';

-- Created by user
ALTER TABLE market_segments
    ADD CONSTRAINT fk_market_segments_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE market_segments
    ADD CONSTRAINT fk_market_segments_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Deleted by user
ALTER TABLE market_segments
    ADD CONSTRAINT fk_market_segments_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: market_segments (33/37)'
\echo '  - 7 foreign key constraints'
\echo '  - Segmentation hierarchy support'
\echo ''
