-- =====================================================
-- 36_rate_overrides_indexes.sql
-- Indexes for rate_overrides table
--
-- Performance optimization for manual rate adjustments
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_rate_overrides_tenant;
DROP INDEX IF EXISTS idx_rate_overrides_reservation;
DROP INDEX IF EXISTS idx_rate_overrides_status;
DROP INDEX IF EXISTS idx_rate_overrides_approval;
DROP INDEX IF EXISTS idx_rate_overrides_reason;
DROP INDEX IF EXISTS idx_rate_overrides_requested;

-- Multi-tenancy index
CREATE INDEX idx_rate_overrides_tenant
    ON rate_overrides(tenant_id, property_id, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_rate_overrides_tenant IS 'Tenant/property override tracking';

-- Reservation overrides
CREATE INDEX idx_rate_overrides_reservation
    ON rate_overrides(reservation_id, stay_date, override_status)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_rate_overrides_reservation IS 'Reservation rate adjustments';

-- Status tracking
CREATE INDEX idx_rate_overrides_status
    ON rate_overrides(property_id, override_status, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_rate_overrides_status IS 'Override status filtering';

-- Pending approvals
CREATE INDEX idx_rate_overrides_approval
    ON rate_overrides(property_id, approval_required, requested_at)
    WHERE deleted_at IS NULL AND approval_required = TRUE AND override_status = 'PENDING';

COMMENT ON INDEX idx_rate_overrides_approval IS 'Overrides awaiting approval';

-- Reason analysis
CREATE INDEX idx_rate_overrides_reason
    ON rate_overrides(property_id, reason_category, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_rate_overrides_reason IS 'Override reason analytics';

-- Recent overrides
CREATE INDEX idx_rate_overrides_requested
    ON rate_overrides(property_id, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_rate_overrides_requested IS 'Recent override activity';

-- Success message
\echo '✓ Indexes created: rate_overrides (36/37)'
\echo '  - 6 performance indexes'
\echo '  - Rate management optimized'
\echo ''
