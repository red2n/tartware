-- =====================================================
-- 92_reservation_guard_locks.sql
-- Reservation Guard Locks Table
-- Purpose: Tracks Availability Guard lock metadata per
--          reservation for deterministic release flows
-- Pattern: Guard-rail state store for write pipeline
-- Date: 2025-12-29
-- =====================================================

\c tartware

\echo 'Creating reservation_guard_locks table...'

-- =====================================================
-- RESERVATION_GUARD_LOCKS TABLE
-- Maps each reservation to its latest Availability Guard
-- lock, enabling deterministic release on cancel/modify.
-- =====================================================

CREATE TABLE IF NOT EXISTS reservation_guard_locks (
    tenant_id UUID NOT NULL,                         -- FK tenants.id for data isolation
    reservation_id UUID NOT NULL,                    -- FK reservations.id being guarded
    lock_id UUID,                                    -- Availability Guard lock identifier
    status VARCHAR(50) NOT NULL,                     -- Guard status (LOCKED, RELEASE_REQUESTED, SKIPPED)
    metadata JSONB DEFAULT '{}'::jsonb,              -- Additional context about the lock state
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Last state change timestamp
    PRIMARY KEY (tenant_id, reservation_id)
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE reservation_guard_locks IS 'Tracks the latest Availability Guard metadata per reservation for deterministic release flows.';
COMMENT ON COLUMN reservation_guard_locks.tenant_id IS 'Multi-tenant discriminator';
COMMENT ON COLUMN reservation_guard_locks.reservation_id IS 'Reservation this guard lock belongs to';
COMMENT ON COLUMN reservation_guard_locks.lock_id IS 'Identifier returned by the Availability Guard service';
COMMENT ON COLUMN reservation_guard_locks.status IS 'Guard lock status: LOCKED, RELEASE_REQUESTED, SKIPPED, etc.';
COMMENT ON COLUMN reservation_guard_locks.metadata IS 'Additional structured context (release reason, correlation_id, etc.)';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_reservation_guard_locks_lock
    ON reservation_guard_locks(lock_id)
    WHERE lock_id IS NOT NULL;

\echo 'reservation_guard_locks table created successfully!'
