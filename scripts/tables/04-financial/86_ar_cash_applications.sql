-- =====================================================
-- 86_ar_cash_applications.sql
-- AR Cash Applications — Payment-to-Invoice Matching
-- Industry Standard: USALI 12th Ed §4.3, SOX AR controls
-- Pattern: Append-only; each row applies a payment to a city ledger entry
-- Date: 2025-07-15
-- =====================================================

\c tartware

CREATE TABLE IF NOT EXISTS ar_cash_applications (
    application_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Surrogate PK
    tenant_id           UUID NOT NULL,                                 -- Tenant scope
    property_id         UUID NOT NULL,                                 -- Property scope
    ar_account_id       UUID NOT NULL,                                 -- FK to ar_accounts
    entry_id            UUID NOT NULL,                                 -- FK to ar_city_ledger

    -- Payment source
    payment_id          UUID,                                          -- FK to payments table (if electronic)
    payment_reference   VARCHAR(255),                                  -- Cheque/wire ref if no payment_id
    payment_date        DATE NOT NULL,                                 -- Date payment was received

    -- Amount applied
    applied_amount      NUMERIC(14, 2) NOT NULL,                       -- Amount applied to this entry
    currency            CHAR(3) NOT NULL DEFAULT 'USD',

    -- Status
    application_status  VARCHAR(20) NOT NULL DEFAULT 'APPLIED'         -- Applied or reversed
        CHECK (application_status IN ('APPLIED', 'REVERSED')),
    reversed_at         TIMESTAMPTZ,                                   -- When reversed
    reversed_by         UUID,                                          -- Who reversed
    reversal_reason     TEXT,                                          -- Reason for reversal

    -- Notes
    notes               TEXT,

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

CREATE INDEX IF NOT EXISTS ar_cash_applications_account_idx
    ON ar_cash_applications (tenant_id, ar_account_id);
CREATE INDEX IF NOT EXISTS ar_cash_applications_entry_idx
    ON ar_cash_applications (tenant_id, entry_id);
CREATE INDEX IF NOT EXISTS ar_cash_applications_payment_idx
    ON ar_cash_applications (tenant_id, payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ar_cash_applications_status_idx
    ON ar_cash_applications (tenant_id, application_status);

COMMENT ON TABLE ar_cash_applications IS
    'Payment-to-city-ledger matching records. Each row applies a payment (electronic or manual) to a specific city ledger entry. Reversible for error correction.';
COMMENT ON COLUMN ar_cash_applications.applied_amount IS
    'Amount applied against the city ledger entry. Multiple applications can exist per entry (partial payments). Sum must not exceed entry original_amount.';

\echo 'ar_cash_applications table created successfully!'
