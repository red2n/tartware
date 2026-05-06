-- =====================================================
-- 82_ar_accounts.sql
-- AR Accounts — Accounts Receivable Credit Accounts
-- Industry Standard: OPERA AR Accounts, USALI 12th Ed §4.3
-- Pattern: One row per company/travel-agent extended credit by the property
-- Date: 2025-07-15
-- =====================================================

\c tartware

-- =====================================================
-- AR_ACCOUNTS TABLE
-- Master AR account for companies, travel agents, and group masters.
-- Tracks credit limits, payment terms, and outstanding balance at the
-- account level (not per-reservation). City ledger entries reference this.
-- =====================================================

CREATE TABLE IF NOT EXISTS ar_accounts (
    -- Primary Key
    ar_account_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Surrogate PK

    -- Multi-tenancy
    tenant_id           UUID NOT NULL,                                 -- Tenant scope
    property_id         UUID NOT NULL,                                 -- Property scope

    -- Account identification
    account_number      VARCHAR(50) NOT NULL,                          -- Human-readable AR-XXXXXXXX
    company_id          UUID,                                          -- FK to companies (optional)
    company_name        VARCHAR(255) NOT NULL,                         -- Denormalized for reporting

    -- Contact
    contact_name        VARCHAR(255),                                  -- Primary billing contact
    contact_email       VARCHAR(255),                                  -- Billing email
    billing_address     TEXT,                                          -- Full billing address

    -- Credit
    credit_limit        NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- Maximum outstanding balance allowed
    payment_terms       VARCHAR(20) NOT NULL DEFAULT 'NET30'           -- Contractual payment terms
        CHECK (payment_terms IN ('NET30', 'NET45', 'NET60', 'DUE_ON_RECEIPT')),
    currency            CHAR(3) NOT NULL DEFAULT 'USD',                -- Billing currency

    -- Balance (maintained by triggers / command handlers)
    outstanding_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,             -- Current unpaid balance
    available_credit    NUMERIC(14, 2) GENERATED ALWAYS AS             -- credit_limit - outstanding_balance
                            (credit_limit - outstanding_balance) STORED,

    -- Status
    account_status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'          -- Lifecycle status
        CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'COLLECTIONS', 'CLOSED')),
    suspended_at        TIMESTAMPTZ,                                   -- When account was suspended
    suspended_reason    TEXT,                                          -- Reason for suspension

    -- Dunning
    dunning_level       INTEGER NOT NULL DEFAULT 0,                    -- 0=none, 1=reminder, 2=warning, 3=collections
    dunning_suppressed_until TIMESTAMPTZ,                              -- Suppress dunning until this date

    -- Notes
    notes               TEXT,                                          -- Free-text notes

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS ar_accounts_tenant_property_number_ux
    ON ar_accounts (tenant_id, property_id, account_number);
CREATE INDEX IF NOT EXISTS ar_accounts_tenant_property_idx
    ON ar_accounts (tenant_id, property_id);
CREATE INDEX IF NOT EXISTS ar_accounts_company_idx
    ON ar_accounts (tenant_id, company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ar_accounts_status_idx
    ON ar_accounts (tenant_id, account_status);

-- Catalog comments
COMMENT ON TABLE ar_accounts IS
    'Master AR account for companies and travel agents extended direct-bill credit by the property. Tracks aggregate outstanding balance and credit limit. Individual city ledger entries reference this via ar_account_id.';
COMMENT ON COLUMN ar_accounts.credit_limit IS 'Maximum total outstanding balance the property will extend. City ledger transfers are blocked when outstanding_balance + transfer_amount > credit_limit.';
COMMENT ON COLUMN ar_accounts.outstanding_balance IS 'Sum of open ar_city_ledger entries for this account. Updated atomically in the same transaction as each transfer/payment/write-off.';
COMMENT ON COLUMN ar_accounts.available_credit IS 'Generated column: credit_limit - outstanding_balance. Used for pre-transfer credit checks.';
COMMENT ON COLUMN ar_accounts.dunning_level IS 'Current dunning escalation: 0=none, 1=first reminder, 2=second warning, 3=collections referral.';

\echo 'ar_accounts table created successfully!'
