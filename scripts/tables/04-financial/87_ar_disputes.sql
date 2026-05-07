-- =====================================================
-- 87_ar_disputes.sql
-- AR Disputes — Disputed City Ledger Entries
-- Industry Standard: USALI 12th Ed §4.3, chargeback best practices
-- Pattern: One dispute per city ledger entry; supports escalation
-- Date: 2025-07-15
-- =====================================================

\c tartware

CREATE TABLE IF NOT EXISTS ar_disputes (
    dispute_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Surrogate PK
    tenant_id           UUID NOT NULL,                                 -- Tenant scope
    property_id         UUID NOT NULL,                                 -- Property scope
    ar_account_id       UUID NOT NULL,                                 -- FK to ar_accounts
    entry_id            UUID NOT NULL,                                 -- FK to ar_city_ledger

    -- Dispute details
    dispute_reason      VARCHAR(50) NOT NULL                           -- Categorised dispute reason
        CHECK (dispute_reason IN (
            'AMOUNT_INCORRECT',      -- Billed amount is wrong
            'CHARGE_NOT_RECOGNISED', -- Guest/company denies the charge
            'DUPLICATE_CHARGE',      -- Already paid or duplicate billing
            'SERVICE_NOT_DELIVERED', -- Service was not rendered
            'RATE_DISAGREEMENT',     -- Wrong rate applied
            'OTHER'                  -- Free-text in notes
        )),
    dispute_amount      NUMERIC(14, 2) NOT NULL,                       -- Disputed portion of the entry
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    dispute_notes       TEXT,                                          -- Detail from the disputing party

    -- Status
    dispute_status      VARCHAR(20) NOT NULL DEFAULT 'OPEN'            -- Lifecycle
        CHECK (dispute_status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED', 'CLOSED')),

    -- Resolution
    resolved_at         TIMESTAMPTZ,                                   -- When resolved
    resolved_by         UUID,                                          -- Who resolved
    resolution_outcome  VARCHAR(30)                                    -- How it was resolved
        CHECK (resolution_outcome IN (
            'UPHELD',             -- Dispute was valid; charge reduced/removed
            'REJECTED',           -- Dispute was invalid; original charge stands
            'PARTIAL',            -- Partial credit granted
            'WRITE_OFF'           -- Written off as bad debt
        )),
    resolution_notes    TEXT,                                          -- Resolution explanation

    -- Escalation
    escalated_at        TIMESTAMPTZ,                                   -- When escalated
    escalated_by        UUID,                                          -- Who escalated
    escalation_notes    TEXT,                                          -- Escalation reason

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS ar_disputes_entry_open_ux
    ON ar_disputes (tenant_id, entry_id)
    WHERE dispute_status NOT IN ('RESOLVED', 'CLOSED');
CREATE INDEX IF NOT EXISTS ar_disputes_account_idx
    ON ar_disputes (tenant_id, ar_account_id, dispute_status);
CREATE INDEX IF NOT EXISTS ar_disputes_status_idx
    ON ar_disputes (tenant_id, dispute_status, created_at DESC);

COMMENT ON TABLE ar_disputes IS
    'Disputed city ledger entries raised by companies or travel agents. Blocks dunning and prevents write-off until resolved. Supports full escalation workflow.';
COMMENT ON COLUMN ar_disputes.dispute_reason IS
    'Categorised reason for dispute. Used for analytics and tracking common dispute patterns.';
COMMENT ON COLUMN ar_disputes.resolution_outcome IS
    'How the dispute was settled: UPHELD (credit issued), REJECTED (charge stands), PARTIAL (partial credit), WRITE_OFF (bad debt).';

\echo 'ar_disputes table created successfully!'
