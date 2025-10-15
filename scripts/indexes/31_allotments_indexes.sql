-- =====================================================
-- 31_allotments_indexes.sql
-- Indexes for allotments table
--
-- Performance optimization for group/block bookings
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_allotments_tenant;
DROP INDEX IF EXISTS idx_allotments_code;
DROP INDEX IF EXISTS idx_allotments_dates;
DROP INDEX IF EXISTS idx_allotments_status;
DROP INDEX IF EXISTS idx_allotments_room_type;
DROP INDEX IF EXISTS idx_allotments_cutoff;
DROP INDEX IF EXISTS idx_allotments_account;

-- Multi-tenancy index
CREATE INDEX idx_allotments_tenant
    ON allotments(tenant_id, property_id, start_date DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_allotments_tenant IS 'Tenant/property allotment tracking';

-- Allotment code lookup
CREATE INDEX idx_allotments_code
    ON allotments(tenant_id, property_id, allotment_code)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_allotments_code IS 'Fast allotment code lookup';

-- Date range queries (active allotments)
CREATE INDEX idx_allotments_dates
    ON allotments(property_id, start_date, end_date, allotment_status)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_allotments_dates IS 'Find allotments by date range';

-- Status filtering
CREATE INDEX idx_allotments_status
    ON allotments(property_id, allotment_status, start_date)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_allotments_status IS 'Status-based filtering';

-- Room type availability
CREATE INDEX idx_allotments_room_type
    ON allotments(property_id, room_type_id, start_date)
    WHERE deleted_at IS NULL AND room_type_id IS NOT NULL;

COMMENT ON INDEX idx_allotments_room_type IS 'Room type block tracking';

-- Cutoff date monitoring
CREATE INDEX idx_allotments_cutoff
    ON allotments(property_id, cutoff_date, allotment_status)
    WHERE deleted_at IS NULL AND cutoff_date IS NOT NULL;

COMMENT ON INDEX idx_allotments_cutoff IS 'Approaching cutoff dates';

-- Account manager tracking
CREATE INDEX idx_allotments_account
    ON allotments(account_manager_id, start_date DESC)
    WHERE deleted_at IS NULL AND account_manager_id IS NOT NULL;

COMMENT ON INDEX idx_allotments_account IS 'Sales person allotment tracking';

-- Success message
\echo '✓ Indexes created: allotments (31/37)'
\echo '  - 7 performance indexes'
\echo '  - Group booking optimized'
\echo ''
