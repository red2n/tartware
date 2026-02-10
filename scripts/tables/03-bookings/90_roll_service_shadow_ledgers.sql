-- =====================================================
-- roll_service_shadow_ledgers
-- Stores deterministic roll outcomes computed in shadow mode.
-- Idempotency enforced via (tenant_id, lifecycle_event_id) unique constraint.
-- =====================================================

\c tartware

\echo 'Creating roll_service_shadow_ledgers table...'

CREATE TABLE IF NOT EXISTS roll_service_shadow_ledgers (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Unique ledger entry identifier
    tenant_id UUID NOT NULL,                               -- FK tenants.id for data isolation
    reservation_id UUID,                                   -- FK reservations.id (NULL for non-reservation rolls)
    lifecycle_event_id UUID NOT NULL,                       -- Source lifecycle event used for idempotency
    roll_type VARCHAR(64) NOT NULL,                         -- Roll classification (EOD, CHECKOUT, CANCEL, etc.)
    roll_date DATE NOT NULL,                                -- Business date of the roll
    occurred_at TIMESTAMPTZ NOT NULL,                       -- When the originating event occurred
    source_event_type VARCHAR(150) NOT NULL,                -- Event type that triggered this roll
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,       -- Original lifecycle data for parity validation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Record creation timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Last update timestamp
    UNIQUE (tenant_id, lifecycle_event_id)
);

COMMENT ON TABLE roll_service_shadow_ledgers IS 'Shadow-mode ledger rows emitted by the roll service for parity validation.';
COMMENT ON COLUMN roll_service_shadow_ledgers.roll_type IS 'Derived roll classification (EOD, CHECKOUT, CANCEL, etc).';
COMMENT ON COLUMN roll_service_shadow_ledgers.event_payload IS 'Original lifecycle data used to compute the roll entry.';

CREATE INDEX IF NOT EXISTS idx_roll_shadow_ledger_reservation
    ON roll_service_shadow_ledgers (reservation_id);

CREATE INDEX IF NOT EXISTS idx_roll_shadow_ledger_roll_date
    ON roll_service_shadow_ledgers (roll_date, tenant_id);

\echo '✓ roll_service_shadow_ledgers created.'
