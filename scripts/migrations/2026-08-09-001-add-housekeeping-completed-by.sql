-- ============================================================================
-- Migration: add-housekeeping-completed-by
-- Version: 2026-08-09-001
-- Created: 2026-08-09T00:00:00+00:00
-- ============================================================================
--
-- Why: housekeeping_tasks records who assigned a task (assigned_to/assigned_at)
-- and who inspected it (inspected_by/inspected_at), but only when it was
-- completed (completed_at) — never by whom. The housekeeping.task.complete
-- handler has always written completed_by, so every completion failed with
-- 42703 and was routed to the DLQ.
--
-- This restores the actor/timestamp pairing the rest of the table already
-- follows, which is also what the audit trail requires: a completion is an
-- accountable action, so the actor must be attributable.
--
-- Additive and backward-compatible: the column is nullable, so rows completed
-- before this migration keep completed_at with a NULL actor rather than being
-- back-filled with a value nobody can vouch for.

BEGIN;

ALTER TABLE housekeeping_tasks
    ADD COLUMN IF NOT EXISTS completed_by UUID;

COMMENT ON COLUMN housekeeping_tasks.completed_by IS
    'Reference to users.id (attendant who completed the task)';

-- Partial index matches the existing idx_hk_tasks_inspected_by convention:
-- the column is sparse, so only non-NULL rows are worth indexing.
CREATE INDEX IF NOT EXISTS idx_hk_tasks_completed_by
    ON housekeeping_tasks(completed_by)
    WHERE completed_by IS NOT NULL;

-- A completed task must record who completed it. Enforced as NOT VALID so the
-- constraint binds all new writes without failing on pre-existing rows that
-- were completed before completed_by existed.
ALTER TABLE housekeeping_tasks
    DROP CONSTRAINT IF EXISTS chk_housekeeping_tasks_completed_actor;

ALTER TABLE housekeeping_tasks
    ADD CONSTRAINT chk_housekeeping_tasks_completed_actor
    CHECK (completed_at IS NULL OR completed_by IS NOT NULL)
    NOT VALID;

COMMIT;

-- ROLLBACK SQL:
-- BEGIN;
-- ALTER TABLE housekeeping_tasks
--     DROP CONSTRAINT IF EXISTS chk_housekeeping_tasks_completed_actor;
-- DROP INDEX IF EXISTS idx_hk_tasks_completed_by;
-- ALTER TABLE housekeeping_tasks DROP COLUMN IF EXISTS completed_by;
-- COMMIT;
