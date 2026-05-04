-- =====================================================
-- 78_night_audit_runs.sql
-- Night Audit Run Tracking & Idempotency Ledger
-- Industry Standard: USALI / OPERA / Fidelio night-audit pattern
-- Pattern: One row per (tenant, property, business_date); UNIQUE blocks re-run
-- Date: 2025-12-19
-- =====================================================

-- ── Enum: night audit run status ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE night_audit_status AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'ROLLED_BACK'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Table: night_audit_runs ──────────────────────────────────────────────────
-- Tracks every night audit attempt. UNIQUE (tenant_id, property_id, business_date)
-- guarantees a business date can only be audited once unless an explicit replay
-- flag deletes/marks the existing row first. Each step records its own progress
-- via current_step + step_started_at so a crash mid-run is recoverable.
CREATE TABLE IF NOT EXISTS night_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Surrogate key
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- Owning tenant
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE, -- Property under audit
  business_date DATE NOT NULL, -- The hotel-day being closed (NOT the calendar timestamp)
  status night_audit_status NOT NULL DEFAULT 'PENDING', -- Lifecycle flag
  current_step VARCHAR(80), -- Name of the step in progress (NULL when PENDING/COMPLETED)
  total_steps INTEGER, -- Number of steps the runner planned (for UI progress %)
  completed_steps INTEGER NOT NULL DEFAULT 0, -- How many steps committed
  step_started_at TIMESTAMPTZ, -- When the current_step began (for stuck-run detection)
  started_at TIMESTAMPTZ, -- When the run transitioned to RUNNING
  finished_at TIMESTAMPTZ, -- When the run reached COMPLETED / FAILED / ROLLED_BACK
  error_message TEXT, -- Captured exception message on FAILED
  error_step VARCHAR(80), -- Which step threw the error
  metadata JSONB, -- Per-step counters, posting totals, etc.
  initiated_by UUID, -- User or system actor that triggered the run
  replay_of UUID REFERENCES night_audit_runs(id), -- If a replay, points to the prior FAILED run
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_night_audit_completed_steps_nonneg CHECK (completed_steps >= 0),
  CONSTRAINT chk_night_audit_total_steps_pos CHECK (total_steps IS NULL OR total_steps >= 0)
);

-- One successful or in-flight run per (tenant, property, business_date).
-- A FAILED/ROLLED_BACK run can coexist with a new attempt only if the runner
-- marks the prior row as ROLLED_BACK first; the partial unique index below
-- enforces that only ONE non-terminal row may exist at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_night_audit_active
  ON night_audit_runs (tenant_id, property_id, business_date)
  WHERE status IN ('PENDING', 'RUNNING', 'COMPLETED');

CREATE INDEX IF NOT EXISTS idx_night_audit_status
  ON night_audit_runs (tenant_id, status, business_date DESC);

CREATE INDEX IF NOT EXISTS idx_night_audit_property_date
  ON night_audit_runs (property_id, business_date DESC);

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE night_audit_runs IS
  'Idempotent ledger of night audit executions. UNIQUE(tenant,property,business_date) prevents re-running a closed hotel-day; each step writes its progress so a crashed run can be diagnosed and resumed.';
COMMENT ON COLUMN night_audit_runs.business_date IS
  'The hotel-day being audited (e.g. 2025-12-18). Distinct from started_at — an audit for 2025-12-18 may run at 2025-12-19 03:00.';
COMMENT ON COLUMN night_audit_runs.status IS
  'PENDING (queued) → RUNNING (in flight) → COMPLETED | FAILED | ROLLED_BACK.';
COMMENT ON COLUMN night_audit_runs.current_step IS
  'Name of the step currently executing. Updated atomically as each step transaction commits.';
COMMENT ON COLUMN night_audit_runs.replay_of IS
  'If this run is a replay of a prior FAILED audit, points to the original row. Used for audit-trail continuity.';

\echo 'night_audit_runs table created successfully!'
