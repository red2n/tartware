-- =====================================================
-- 33_market_segments_indexes.sql
-- Indexes for market_segments table
--
-- Performance optimization for customer segmentation
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_market_segments_tenant;
DROP INDEX IF EXISTS idx_market_segments_code;
DROP INDEX IF EXISTS idx_market_segments_type;
DROP INDEX IF EXISTS idx_market_segments_active;
DROP INDEX IF EXISTS idx_market_segments_parent;

-- Multi-tenancy index
CREATE INDEX idx_market_segments_tenant
    ON market_segments(tenant_id, property_id, segment_code)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_market_segments_tenant IS 'Tenant/property segment tracking';

-- Segment code lookup
CREATE INDEX idx_market_segments_code
    ON market_segments(segment_code, is_active)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_market_segments_code IS 'Fast segment code lookup';

-- Segment type filtering
CREATE INDEX idx_market_segments_type
    ON market_segments(property_id, segment_type, is_active)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_market_segments_type IS 'Segment type filtering (CORPORATE, LEISURE, etc.)';

-- Active segments with ranking
CREATE INDEX idx_market_segments_active
    ON market_segments(property_id, is_active, ranking)
    WHERE deleted_at IS NULL AND is_active = TRUE;

COMMENT ON INDEX idx_market_segments_active IS 'Active segments by priority';

-- Hierarchical segments
CREATE INDEX idx_market_segments_parent
    ON market_segments(parent_segment_id, segment_level)
    WHERE deleted_at IS NULL AND parent_segment_id IS NOT NULL;

COMMENT ON INDEX idx_market_segments_parent IS 'Segment hierarchy navigation';

-- Success message
\echo '✓ Indexes created: market_segments (33/37)'
\echo '  - 5 performance indexes'
\echo '  - Segmentation analytics optimized'
\echo ''
