-- =====================================================
-- 30_deposit_schedules_indexes.sql
-- Indexes for deposit_schedules table
--
-- Performance optimization for payment schedules
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_deposit_schedules_tenant;
DROP INDEX IF EXISTS idx_deposit_schedules_reservation;
DROP INDEX IF EXISTS idx_deposit_schedules_guest;
DROP INDEX IF EXISTS idx_deposit_schedules_due_date;
DROP INDEX IF EXISTS idx_deposit_schedules_status;
DROP INDEX IF EXISTS idx_deposit_schedules_overdue;
DROP INDEX IF EXISTS idx_deposit_schedules_folio;

-- Multi-tenancy index
CREATE INDEX idx_deposit_schedules_tenant
    ON deposit_schedules(tenant_id, property_id, due_date)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_deposit_schedules_tenant IS 'Tenant/property schedule tracking';

-- Reservation payment schedules
CREATE INDEX idx_deposit_schedules_reservation
    ON deposit_schedules(reservation_id, sequence_number, due_date)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_deposit_schedules_reservation IS 'Reservation payment plan';

-- Guest payment history
CREATE INDEX idx_deposit_schedules_guest
    ON deposit_schedules(guest_id, due_date DESC)
    WHERE deleted_at IS NULL AND guest_id IS NOT NULL;

COMMENT ON INDEX idx_deposit_schedules_guest IS 'Guest payment schedule history';

-- Due date tracking (upcoming payments)
CREATE INDEX idx_deposit_schedules_due_date
    ON deposit_schedules(property_id, due_date, schedule_status)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_deposit_schedules_due_date IS 'Upcoming payment tracking';

-- Status filtering
CREATE INDEX idx_deposit_schedules_status
    ON deposit_schedules(property_id, schedule_status, due_date)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_deposit_schedules_status IS 'Status-based queries';

-- Overdue payments
CREATE INDEX idx_deposit_schedules_overdue
    ON deposit_schedules(property_id, is_overdue, overdue_since)
    WHERE deleted_at IS NULL AND is_overdue = TRUE;

COMMENT ON INDEX idx_deposit_schedules_overdue IS 'Find overdue payments';

-- Folio association
CREATE INDEX idx_deposit_schedules_folio
    ON deposit_schedules(folio_id, due_date)
    WHERE deleted_at IS NULL AND folio_id IS NOT NULL;

COMMENT ON INDEX idx_deposit_schedules_folio IS 'Folio payment schedule';

-- Success message
\echo '✓ Indexes created: deposit_schedules (30/37)'
\echo '  - 7 performance indexes'
\echo '  - Payment tracking optimized'
\echo ''
\echo '==================================='
\echo '✓ PHASE 1 INDEXES COMPLETE (6/13)'
\echo '==================================='
\echo ''
