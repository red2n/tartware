-- =====================================================
-- 35_refunds_indexes.sql
-- Indexes for refunds table
--
-- Performance optimization for refund management
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_refunds_tenant;
DROP INDEX IF EXISTS idx_refunds_reservation;
DROP INDEX IF EXISTS idx_refunds_guest;
DROP INDEX IF EXISTS idx_refunds_status;
DROP INDEX IF EXISTS idx_refunds_approval;
DROP INDEX IF EXISTS idx_refunds_requested;
DROP INDEX IF EXISTS idx_refunds_folio;

-- Multi-tenancy index
CREATE INDEX idx_refunds_tenant
    ON refunds(tenant_id, property_id, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_refunds_tenant IS 'Tenant/property refund tracking';

-- Reservation refunds
CREATE INDEX idx_refunds_reservation
    ON refunds(reservation_id, refund_status, requested_at DESC)
    WHERE deleted_at IS NULL AND reservation_id IS NOT NULL;

COMMENT ON INDEX idx_refunds_reservation IS 'Reservation refund history';

-- Guest refund history
CREATE INDEX idx_refunds_guest
    ON refunds(guest_id, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_refunds_guest IS 'Guest refund history';

-- Status tracking
CREATE INDEX idx_refunds_status
    ON refunds(property_id, refund_status, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_refunds_status IS 'Status-based refund queries';

-- Pending approvals
CREATE INDEX idx_refunds_approval
    ON refunds(property_id, requires_approval, requested_at)
    WHERE deleted_at IS NULL AND requires_approval = TRUE AND refund_status = 'PENDING_APPROVAL';

COMMENT ON INDEX idx_refunds_approval IS 'Refunds awaiting approval';

-- Recent refunds
CREATE INDEX idx_refunds_requested
    ON refunds(property_id, requested_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_refunds_requested IS 'Recent refund activity';

-- Folio refunds
CREATE INDEX idx_refunds_folio
    ON refunds(folio_id, requested_at DESC)
    WHERE deleted_at IS NULL AND folio_id IS NOT NULL;

COMMENT ON INDEX idx_refunds_folio IS 'Folio refund tracking';

-- Success message
\echo '✓ Indexes created: refunds (35/37)'
\echo '  - 7 performance indexes'
\echo '  - Refund workflow optimized'
\echo ''
