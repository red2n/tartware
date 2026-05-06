-- =====================================================
-- 84_ar_aging_snapshots.sql
-- AR Aging Snapshots — Nightly Aging Summary per Account
-- Industry Standard: USALI 12th Ed §4.3, OPERA Aging Report
-- Pattern: Append-only nightly snapshots; never updated after creation
-- Date: 2025-07-15
-- =====================================================

\c tartware

CREATE TABLE IF NOT EXISTS ar_aging_snapshots (
    snapshot_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Surrogate PK
    tenant_id           UUID NOT NULL,                                 -- Tenant scope
    property_id         UUID NOT NULL,                                 -- Property scope
    ar_account_id       UUID NOT NULL,                                 -- FK to ar_accounts
    snapshot_date       DATE NOT NULL,                                 -- Business date of snapshot

    -- Aging buckets (amounts in account currency)
    current_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- 0-30 days
    bucket_1_30         NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- 31-60 days
    bucket_31_60        NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- 61-90 days
    bucket_61_90        NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- 91-120 days
    bucket_91_120       NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- 121-150 days
    bucket_over_120     NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- >150 days
    total_outstanding   NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- Sum of all buckets
    currency            CHAR(3) NOT NULL DEFAULT 'USD',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS ar_aging_snapshots_account_date_ux
    ON ar_aging_snapshots (tenant_id, ar_account_id, snapshot_date);
CREATE INDEX IF NOT EXISTS ar_aging_snapshots_property_date_idx
    ON ar_aging_snapshots (tenant_id, property_id, snapshot_date DESC);

COMMENT ON TABLE ar_aging_snapshots IS
    'Append-only nightly aging summaries per AR account. Used for trend analysis and dunning triggers.';
COMMENT ON COLUMN ar_aging_snapshots.current_amount IS
    'Balance outstanding 0-30 days from transfer_date.';
COMMENT ON COLUMN ar_aging_snapshots.bucket_over_120 IS
    'Balance outstanding more than 120 days — highest collection risk.';

\echo 'ar_aging_snapshots table created successfully!'
