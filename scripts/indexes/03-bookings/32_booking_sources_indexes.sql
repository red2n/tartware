-- =====================================================
-- 32_booking_sources_indexes.sql
-- Indexes for booking_sources table
--
-- Performance optimization for channel tracking
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_booking_sources_tenant;
DROP INDEX IF EXISTS idx_booking_sources_code;
DROP INDEX IF EXISTS idx_booking_sources_type;
DROP INDEX IF EXISTS idx_booking_sources_active;
DROP INDEX IF EXISTS idx_booking_sources_integration;

-- Multi-tenancy index
CREATE INDEX idx_booking_sources_tenant
    ON booking_sources(tenant_id, property_id, source_code)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_booking_sources_tenant IS 'Tenant/property source tracking';

-- Source code lookup
CREATE INDEX idx_booking_sources_code
    ON booking_sources(source_code, is_active)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_booking_sources_code IS 'Fast source code lookup';

-- Source type filtering
CREATE INDEX idx_booking_sources_type
    ON booking_sources(property_id, source_type, is_active)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_booking_sources_type IS 'Channel type filtering (OTA, GDS, DIRECT, etc.)';

-- Active sources with ranking
CREATE INDEX idx_booking_sources_active
    ON booking_sources(property_id, is_active, ranking)
    WHERE deleted_at IS NULL AND is_active = TRUE;

COMMENT ON INDEX idx_booking_sources_active IS 'Active channels by priority';

-- Integration status
CREATE INDEX idx_booking_sources_integration
    ON booking_sources(property_id, has_integration, last_sync_at)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_booking_sources_integration IS 'Channel integration monitoring';

-- Success message
\echo '✓ Indexes created: booking_sources (32/37)'
\echo '  - 5 performance indexes'
\echo '  - Channel management optimized'
\echo ''
