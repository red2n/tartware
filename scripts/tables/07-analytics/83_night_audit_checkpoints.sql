-- =====================================================
-- 83_night_audit_checkpoints.sql
-- Night Audit Step Checkpoints
-- Industry Standard: PMS EOD process tracking (OPERA, Protel)
-- Pattern: Checkpoint / resume-from-failure
-- Date: 2026-04-29
-- =====================================================

-- =====================================================
-- NIGHT_AUDIT_CHECKPOINTS TABLE
-- Per-step completion record for every night audit run.
-- All checkpoint rows are written inside the main audit
-- transaction, so they commit or roll back atomically
-- with the charge postings they describe.  A missing row
-- for a given step means that step did not complete
-- successfully.
-- =====================================================

\c tartware

CREATE TABLE IF NOT EXISTS night_audit_checkpoints (
    checkpoint_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Audit run identity
    tenant_id       UUID        NOT NULL, -- Owning tenant
    property_id     UUID        NOT NULL, -- Property being audited
    audit_run_id    UUID        NOT NULL, -- Matches night_audit_log.audit_run_id

    -- Step tracking
    step_number     INTEGER     NOT NULL, -- 1=lock, 2=room-charges, 3=packages, 4=commissions, 5=no-shows
    step_name       VARCHAR(100) NOT NULL, -- Human-readable name for tooling / support queries

    -- Outcome
    status          VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
                        CHECK (status IN ('COMPLETED', 'SKIPPED', 'FAILED')),
                        -- FAILED rows are written outside the main TX (in the error path)
                        -- so they survive a rollback and are available for diagnostics.

    -- Metrics
    records_processed INTEGER DEFAULT 0, -- How many rows were handled in this step

    -- Timing
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,

    -- Actor
    created_by      UUID,

    -- Soft-delete (standard audit field — checkpoints are never hard-deleted)
    is_deleted      BOOLEAN     NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    deleted_by      VARCHAR(255),

    -- Each audit run records each step at most once
    CONSTRAINT uq_night_audit_checkpoint UNIQUE (audit_run_id, step_number)
);

COMMENT ON TABLE night_audit_checkpoints IS 'Per-step completion record for each night audit run; committed atomically with charge postings';
COMMENT ON COLUMN night_audit_checkpoints.audit_run_id IS 'Foreign key to night_audit_log.audit_run_id — groups all steps of one run';
COMMENT ON COLUMN night_audit_checkpoints.step_number IS '2=room-charges, 3=packages, 4=commissions, 5=no-shows';
COMMENT ON COLUMN night_audit_checkpoints.status IS 'COMPLETED = step ran and produced records; SKIPPED = step was disabled by command flag; FAILED = step threw an error (written outside TX so it survives rollback)';
COMMENT ON COLUMN night_audit_checkpoints.records_processed IS 'Number of reservations/items processed by this step';

-- Idempotent upgrade: widen the CHECK constraint if it does not yet include FAILED.
-- Safe to re-run on any DB state (fresh or upgrade).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'night_audit_checkpoints'::regclass
          AND contype = 'c'
          AND conname = 'night_audit_checkpoints_status_check'
          AND pg_get_constraintdef(oid) NOT LIKE '%FAILED%'
    ) THEN
        ALTER TABLE night_audit_checkpoints
            DROP CONSTRAINT night_audit_checkpoints_status_check;
        ALTER TABLE night_audit_checkpoints
            ADD CONSTRAINT night_audit_checkpoints_status_check
                CHECK (status IN ('COMPLETED', 'SKIPPED', 'FAILED'));
    END IF;
END$$;

-- Lookup: all checkpoints for a run (used by recovery tooling)
CREATE INDEX IF NOT EXISTS idx_night_audit_checkpoints_run
    ON night_audit_checkpoints (tenant_id, property_id, audit_run_id);

GRANT SELECT, INSERT ON night_audit_checkpoints TO tartware_app;

-- Row-Level Security: enforce tenant isolation
ALTER TABLE night_audit_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_audit_checkpoints FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_night_audit_checkpoints
    ON night_audit_checkpoints
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

\echo 'night_audit_checkpoints table created successfully!'
