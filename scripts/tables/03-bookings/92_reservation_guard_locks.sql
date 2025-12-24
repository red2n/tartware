\c tartware

\echo 'Creating reservation_guard_locks table...'

CREATE TABLE IF NOT EXISTS reservation_guard_locks (
    tenant_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    lock_id UUID,
    status VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, reservation_id)
);

COMMENT ON TABLE reservation_guard_locks IS 'Tracks the latest Availability Guard metadata per reservation for deterministic release flows.';
COMMENT ON COLUMN reservation_guard_locks.lock_id IS 'Identifier returned by the Availability Guard service.';
COMMENT ON COLUMN reservation_guard_locks.status IS 'LOCKED, RELEASE_REQUESTED, SKIPPED, etc.';

CREATE INDEX IF NOT EXISTS idx_reservation_guard_locks_lock
    ON reservation_guard_locks(lock_id)
    WHERE lock_id IS NOT NULL;

\echo 'reservation_guard_locks table ready.'
