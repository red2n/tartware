-- =====================================================
-- roll_service_shadow_ledgers
-- Stores deterministic roll outcomes computed in shadow mode.
-- Idempotency enforced via (tenant_id, lifecycle_event_id) unique constraint.
-- =====================================================

\c tartware

\echo 'Creating roll_service_shadow_ledgers table...'

CREATE TABLE IF NOT EXISTS roll_service_shadow_ledgers (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    reservation_id UUID,
    lifecycle_event_id UUID NOT NULL,
    roll_type VARCHAR(64) NOT NULL,
    roll_date DATE NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    source_event_type VARCHAR(150) NOT NULL,
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
