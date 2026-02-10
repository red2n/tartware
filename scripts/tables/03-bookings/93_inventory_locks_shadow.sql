-- =====================================================
-- inventory_locks_shadow.sql
-- Shadow inventory locks used by the availability-guard-service
-- to track room/room-type holds for reservations.
-- =====================================================

\c tartware

\echo 'Creating inventory_locks_shadow table...'

CREATE TABLE IF NOT EXISTS inventory_locks_shadow (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),   -- Unique lock ID; doubles as idempotency key
    tenant_id       UUID NOT NULL,                                 -- FK tenants.id for data isolation
    reservation_id  UUID,                                          -- FK reservations.id (NULL for speculative locks)
    room_type_id    UUID NOT NULL,                                 -- FK room_types.id being locked
    room_id         UUID,                                          -- FK rooms.id for room-level locks (NULL for type-level)
    stay_start      TIMESTAMPTZ NOT NULL,                          -- Start of the locked date range
    stay_end        TIMESTAMPTZ NOT NULL,                          -- End of the locked date range
    reason          VARCHAR(100) NOT NULL,                         -- Why the lock was created (RESERVATION_CREATE, etc.)
    correlation_id  VARCHAR(255),                                  -- Correlation ID from the originating command
    expires_at      TIMESTAMPTZ,                                   -- Absolute expiration timestamp
    ttl_seconds     INTEGER,                                       -- Requested TTL in seconds
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,             -- Additional structured context
    status          VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'          -- Lock state: ACTIVE or RELEASED
                    CHECK (status IN ('ACTIVE', 'RELEASED')),
    release_reason  TEXT,                                          -- Reason for releasing the lock
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),            -- Record creation timestamp
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),            -- Last update timestamp

    CONSTRAINT chk_stay_range CHECK (stay_end > stay_start),
    CONSTRAINT chk_ttl_positive CHECK (ttl_seconds IS NULL OR ttl_seconds >= 0)
);

COMMENT ON TABLE inventory_locks_shadow IS 'Shadow inventory locks for room availability tracking by the availability-guard-service.';
COMMENT ON COLUMN inventory_locks_shadow.id IS 'Primary key; doubles as the idempotency key for lock requests.';
COMMENT ON COLUMN inventory_locks_shadow.tenant_id IS 'Multi-tenant discriminator.';
COMMENT ON COLUMN inventory_locks_shadow.reservation_id IS 'Associated reservation (nullable for speculative locks).';
COMMENT ON COLUMN inventory_locks_shadow.room_type_id IS 'Room type being locked.';
COMMENT ON COLUMN inventory_locks_shadow.room_id IS 'Specific room being locked (NULL for type-level locks).';
COMMENT ON COLUMN inventory_locks_shadow.stay_start IS 'Start of the locked date range.';
COMMENT ON COLUMN inventory_locks_shadow.stay_end IS 'End of the locked date range.';
COMMENT ON COLUMN inventory_locks_shadow.reason IS 'Why the lock was created (e.g., RESERVATION_CREATE, RESERVATION_MODIFY).';
COMMENT ON COLUMN inventory_locks_shadow.correlation_id IS 'Correlation ID from the originating command.';
COMMENT ON COLUMN inventory_locks_shadow.expires_at IS 'Absolute expiration timestamp for this lock.';
COMMENT ON COLUMN inventory_locks_shadow.ttl_seconds IS 'Requested TTL in seconds.';
COMMENT ON COLUMN inventory_locks_shadow.metadata IS 'Additional structured context about the lock.';
COMMENT ON COLUMN inventory_locks_shadow.status IS 'ACTIVE or RELEASED.';
COMMENT ON COLUMN inventory_locks_shadow.release_reason IS 'Human/system reason for releasing the lock.';

-- Index for conflict detection queries (the hot path)
CREATE INDEX IF NOT EXISTS idx_inventory_locks_shadow_conflict
    ON inventory_locks_shadow (tenant_id, room_type_id, status)
    WHERE status = 'ACTIVE';

-- Index for room-level conflict lookups
CREATE INDEX IF NOT EXISTS idx_inventory_locks_shadow_room_conflict
    ON inventory_locks_shadow (tenant_id, room_id, status)
    WHERE status = 'ACTIVE' AND room_id IS NOT NULL;

-- Index for reservation-scoped lookups
CREATE INDEX IF NOT EXISTS idx_inventory_locks_shadow_reservation
    ON inventory_locks_shadow (reservation_id)
    WHERE reservation_id IS NOT NULL;

-- Index for TTL reaper / expired lock cleanup
CREATE INDEX IF NOT EXISTS idx_inventory_locks_shadow_expires
    ON inventory_locks_shadow (expires_at)
    WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

-- Index for tenant-scoped listing and auditing
CREATE INDEX IF NOT EXISTS idx_inventory_locks_shadow_tenant
    ON inventory_locks_shadow (tenant_id, created_at DESC);

\echo 'inventory_locks_shadow table created successfully!'
