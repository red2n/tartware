-- =====================================================
-- 83_ar_city_ledger.sql
-- AR City Ledger — Individual Transfer Entries
-- Industry Standard: OPERA City Ledger, USALI 12th Ed §4.3 Direct Bill
-- Pattern: One row per folio balance transferred to an AR account
-- Date: 2025-07-15
-- =====================================================

\c tartware

-- =====================================================
-- AR_CITY_LEDGER TABLE
-- Each row represents a folio balance transferred to an AR account after
-- guest departure. City ledger entries are the building blocks of the AR
-- aging report and dunning workflow.
-- =====================================================

CREATE TABLE IF NOT EXISTS ar_city_ledger (
    -- Primary Key
    entry_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Surrogate PK

    -- Multi-tenancy
    tenant_id           UUID NOT NULL,                                 -- Tenant scope
    property_id         UUID NOT NULL,                                 -- Property scope

    -- AR Account
    ar_account_id       UUID NOT NULL,                                 -- FK to ar_accounts

    -- Source documents
    folio_id            UUID,                                          -- Source folio
    reservation_id      UUID,                                          -- Source reservation
    invoice_id          UUID,                                          -- Source invoice (if finalized)

    -- Reference
    entry_number        VARCHAR(50) NOT NULL,                          -- Human-readable CL-XXXXXXXX
    transfer_date       DATE NOT NULL,                                 -- Date balance was transferred
    due_date            DATE NOT NULL,                                 -- Payment due (from payment terms)

    -- Amount
    original_amount     NUMERIC(14, 2) NOT NULL,                       -- Amount at transfer time
    outstanding_balance NUMERIC(14, 2) NOT NULL,                       -- Remaining unpaid balance
    currency            CHAR(3) NOT NULL DEFAULT 'USD',                -- Billing currency

    -- Status
    entry_status        VARCHAR(20) NOT NULL DEFAULT 'OPEN'            -- Lifecycle status
        CHECK (entry_status IN ('OPEN', 'PARTIAL', 'PAID', 'WRITTEN_OFF', 'DISPUTED', 'CANCELLED')),

    -- Aging (recalculated nightly)
    days_outstanding    INTEGER NOT NULL DEFAULT 0,                    -- Days since transfer_date
    aging_bucket        VARCHAR(20) NOT NULL DEFAULT 'CURRENT'         -- Current aging bracket
        CHECK (aging_bucket IN ('CURRENT', '1_30', '31_60', '61_90', '91_120', 'OVER_120')),

    -- Write-off / dispute
    written_off_at      TIMESTAMPTZ,                                   -- When written off
    written_off_by      UUID,                                          -- Who authorised write-off
    write_off_reason    TEXT,                                          -- Reason for write-off
    dispute_id          UUID,                                          -- FK to ar_disputes if disputed

    -- Notes
    notes               TEXT,                                          -- Transfer notes

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS ar_city_ledger_tenant_entry_ux
    ON ar_city_ledger (tenant_id, entry_number);
CREATE UNIQUE INDEX IF NOT EXISTS ar_city_ledger_folio_account_ux
    ON ar_city_ledger (tenant_id, folio_id, ar_account_id)
    WHERE folio_id IS NOT NULL AND entry_status NOT IN ('CANCELLED', 'WRITTEN_OFF');
CREATE INDEX IF NOT EXISTS ar_city_ledger_account_idx
    ON ar_city_ledger (tenant_id, ar_account_id);
CREATE INDEX IF NOT EXISTS ar_city_ledger_status_idx
    ON ar_city_ledger (tenant_id, entry_status, due_date);
CREATE INDEX IF NOT EXISTS ar_city_ledger_aging_idx
    ON ar_city_ledger (tenant_id, aging_bucket, ar_account_id);
CREATE INDEX IF NOT EXISTS ar_city_ledger_property_idx
    ON ar_city_ledger (tenant_id, property_id, transfer_date);

-- Catalog comments
COMMENT ON TABLE ar_city_ledger IS
    'Individual city ledger entries: each row is a folio balance transferred to an AR account after guest departure. Drives the AR aging report and dunning workflow.';
COMMENT ON COLUMN ar_city_ledger.aging_bucket IS
    'CURRENT (<30d), 1_30 (31-60d), 31_60 (61-90d) ... recalculated nightly by ar.aging.compute.';
COMMENT ON COLUMN ar_city_ledger.days_outstanding IS
    'Computed nightly: CURRENT_DATE - transfer_date. Used to categorise into aging_bucket.';

\echo 'ar_city_ledger table created successfully!'
