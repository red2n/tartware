-- =====================================================
-- 11_gl_chart_of_accounts.sql
-- USALI General Ledger Chart of Accounts
-- Industry Standard: USALI 12th Edition (Uniform System
--   of Accounts for the Lodging Industry)
-- Pattern: Reference data seeded once per tenant; tenant
--   may override descriptions and add custom accounts.
-- Date: 2026-04-29
-- =====================================================

-- =====================================================
-- GL_CHART_OF_ACCOUNTS TABLE
-- USALI-aligned chart of accounts for hospitality GL.
-- Each row maps an account code to its USALI category,
-- normal balance side, and financial statement line.
-- =====================================================

\c tartware

\echo '  [ref] Creating gl_chart_of_accounts table...'

CREATE TABLE IF NOT EXISTS gl_chart_of_accounts (
    -- Primary Key
    gl_account_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id       UUID        NOT NULL, -- Owning tenant

    -- Account Identity
    account_code    VARCHAR(20) NOT NULL, -- e.g. '1100', '4000'
    account_name    VARCHAR(100) NOT NULL, -- e.g. 'Guest Ledger Receivable'
    account_type    VARCHAR(20) NOT NULL  -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
                        CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    normal_balance  VARCHAR(6)  NOT NULL  -- DEBIT or CREDIT (normal balance side per USALI)
                        CHECK (normal_balance IN ('DEBIT', 'CREDIT')),

    -- USALI Classification
    usali_category  VARCHAR(100),         -- e.g. 'Rooms Revenue', 'Guest Ledger'
    usali_section   VARCHAR(50),          -- Schedule section: A, B, C, D, E etc.
    financial_line  VARCHAR(100),         -- Statement line description for reports

    -- Hierarchy
    parent_account_code VARCHAR(20),      -- Optional grouping parent (e.g. '1000' groups all AR)
    display_order   INTEGER NOT NULL DEFAULT 0,

    -- State
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_system       BOOLEAN NOT NULL DEFAULT false, -- System accounts cannot be deleted

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_at      TIMESTAMPTZ,
    updated_by      UUID,

    -- Soft Delete
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID,

    CONSTRAINT uq_gl_chart_account UNIQUE (tenant_id, account_code)
);

COMMENT ON TABLE gl_chart_of_accounts IS 'USALI 12th Edition chart of accounts; one row per GL account per tenant';
COMMENT ON COLUMN gl_chart_of_accounts.account_code IS 'Numeric or alphanumeric GL account code (e.g. 1100, 4000)';
COMMENT ON COLUMN gl_chart_of_accounts.account_type IS 'ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE — drives DR/CR display';
COMMENT ON COLUMN gl_chart_of_accounts.normal_balance IS 'DEBIT for asset/expense accounts; CREDIT for liability/equity/revenue';
COMMENT ON COLUMN gl_chart_of_accounts.usali_category IS 'USALI category used for report aggregation';
COMMENT ON COLUMN gl_chart_of_accounts.is_system IS 'System accounts (Guest Ledger, Cash, Tax Payable) cannot be deleted by tenants';

CREATE INDEX IF NOT EXISTS idx_gl_chart_tenant_code
    ON gl_chart_of_accounts (tenant_id, account_code)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_gl_chart_tenant_type
    ON gl_chart_of_accounts (tenant_id, account_type)
    WHERE is_deleted = false;

GRANT SELECT, INSERT, UPDATE ON gl_chart_of_accounts TO tartware_app;

-- Row-Level Security
ALTER TABLE gl_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_chart_of_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_gl_chart_of_accounts
    ON gl_chart_of_accounts
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- =====================================================
-- SEED: USALI 12th Edition standard accounts
-- Seeded for the default dev tenant only.
-- Account codes follow USALI numbering conventions.
-- =====================================================
\echo '  [ref] Seeding USALI chart of accounts...'

INSERT INTO gl_chart_of_accounts
    (tenant_id, account_code, account_name, account_type, normal_balance,
     usali_category, usali_section, financial_line, parent_account_code, display_order, is_system)
VALUES
    -- ── ASSETS (1xxx) ──────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', '1000', 'Current Assets',               'ASSET',     'DEBIT',  'Current Assets',              NULL,  'Total Current Assets',               NULL,    10,  false),
    ('11111111-1111-1111-1111-111111111111', '1100', 'Guest Ledger Receivable',       'ASSET',     'DEBIT',  'Guest Ledger',                'A',   'Guest Ledger Receivable',            '1000',  20,  true),
    ('11111111-1111-1111-1111-111111111111', '1110', 'Cash - Front Desk',             'ASSET',     'DEBIT',  'Cash and Cash Equivalents',   'A',   'Cash and Cash Equivalents',          '1000',  30,  true),
    ('11111111-1111-1111-1111-111111111111', '1120', 'Cash - Bank',                   'ASSET',     'DEBIT',  'Cash and Cash Equivalents',   'A',   'Bank Account',                       '1000',  31,  true),
    ('11111111-1111-1111-1111-111111111111', '1130', 'Credit Card Receivable',        'ASSET',     'DEBIT',  'Cash and Cash Equivalents',   'A',   'Credit Card Receivable',             '1000',  32,  true),
    ('11111111-1111-1111-1111-111111111111', '1200', 'City Ledger (AR)',              'ASSET',     'DEBIT',  'Accounts Receivable',         'B',   'City Ledger Receivable',             '1000',  40,  true),
    ('11111111-1111-1111-1111-111111111111', '1210', 'Group Master Bill Receivable',  'ASSET',     'DEBIT',  'Accounts Receivable',         'B',   'Group Master Bill Receivable',       '1000',  41,  false),
    ('11111111-1111-1111-1111-111111111111', '1300', 'Advance Deposit Asset',         'ASSET',     'DEBIT',  'Advance Deposits',            'C',   'Advance Deposit Clearing',           '1000',  50,  false),
    ('11111111-1111-1111-1111-111111111111', '1400', 'Inventories',                   'ASSET',     'DEBIT',  'Inventories',                 'C',   'Inventory',                          '1000',  60,  false),

    -- ── LIABILITIES (2xxx) ─────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', '2000', 'Current Liabilities',           'LIABILITY', 'CREDIT', 'Current Liabilities',         NULL,  'Total Current Liabilities',          NULL,    100, false),
    ('11111111-1111-1111-1111-111111111111', '2100', 'Tax Payable',                   'LIABILITY', 'CREDIT', 'Taxes',                       'D',   'Sales/Use Tax Payable',              '2000',  110, true),
    ('11111111-1111-1111-1111-111111111111', '2110', 'Occupancy Tax Payable',         'LIABILITY', 'CREDIT', 'Taxes',                       'D',   'Occupancy Tax Payable',              '2000',  111, false),
    ('11111111-1111-1111-1111-111111111111', '2120', 'Tourism Levy Payable',          'LIABILITY', 'CREDIT', 'Taxes',                       'D',   'Tourism Levy Payable',               '2000',  112, false),
    ('11111111-1111-1111-1111-111111111111', '2200', 'Advance Deposits Liability',    'LIABILITY', 'CREDIT', 'Advance Deposits',            'D',   'Advance Deposit Liability',          '2000',  120, true),
    ('11111111-1111-1111-1111-111111111111', '2210', 'Security Deposits',             'LIABILITY', 'CREDIT', 'Deposits',                    'D',   'Security Deposit Liability',         '2000',  121, false),
    ('11111111-1111-1111-1111-111111111111', '2300', 'Accrued Commission Payable',    'LIABILITY', 'CREDIT', 'Accrued Liabilities',         'D',   'Commission Payable',                 '2000',  130, false),
    ('11111111-1111-1111-1111-111111111111', '2400', 'Accrued Salaries & Wages',      'LIABILITY', 'CREDIT', 'Accrued Liabilities',         'D',   'Accrued Salaries & Wages',           '2000',  140, false),
    ('11111111-1111-1111-1111-111111111111', '2500', 'Unearned Revenue',              'LIABILITY', 'CREDIT', 'Deferred Revenue',            'D',   'Unearned Revenue',                   '2000',  150, false),

    -- ── REVENUE (4xxx) ─────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', '4000', 'Rooms Revenue',                 'REVENUE',   'CREDIT', 'Rooms Revenue',               'E',   'Rooms Revenue',                      NULL,    200, true),
    ('11111111-1111-1111-1111-111111111111', '4010', 'Transient Room Revenue',        'REVENUE',   'CREDIT', 'Rooms Revenue',               'E',   'Transient Room Revenue',             '4000',  201, false),
    ('11111111-1111-1111-1111-111111111111', '4020', 'Group Room Revenue',            'REVENUE',   'CREDIT', 'Rooms Revenue',               'E',   'Group Room Revenue',                 '4000',  202, false),
    ('11111111-1111-1111-1111-111111111111', '4030', 'Contract/Wholesale Revenue',    'REVENUE',   'CREDIT', 'Rooms Revenue',               'E',   'Contract Room Revenue',              '4000',  203, false),
    ('11111111-1111-1111-1111-111111111111', '4100', 'Food & Beverage Revenue',       'REVENUE',   'CREDIT', 'Food & Beverage Revenue',     'F',   'Food & Beverage Revenue',            NULL,    210, true),
    ('11111111-1111-1111-1111-111111111111', '4110', 'Restaurant Revenue',            'REVENUE',   'CREDIT', 'Food & Beverage Revenue',     'F',   'Restaurant Revenue',                 '4100',  211, false),
    ('11111111-1111-1111-1111-111111111111', '4120', 'Bar Revenue',                   'REVENUE',   'CREDIT', 'Food & Beverage Revenue',     'F',   'Bar Revenue',                        '4100',  212, false),
    ('11111111-1111-1111-1111-111111111111', '4130', 'Room Service Revenue',          'REVENUE',   'CREDIT', 'Food & Beverage Revenue',     'F',   'Room Service Revenue',               '4100',  213, false),
    ('11111111-1111-1111-1111-111111111111', '4200', 'Other Revenue - Fees',          'REVENUE',   'CREDIT', 'Other Revenue',               'G',   'Resort/Amenity Fee Revenue',         NULL,    220, false),
    ('11111111-1111-1111-1111-111111111111', '4300', 'Spa Revenue',                   'REVENUE',   'CREDIT', 'Spa Revenue',                 'H',   'Spa Revenue',                        NULL,    230, false),
    ('11111111-1111-1111-1111-111111111111', '4400', 'Parking Revenue',               'REVENUE',   'CREDIT', 'Other Revenue',               'G',   'Parking Revenue',                    NULL,    240, false),
    ('11111111-1111-1111-1111-111111111111', '4500', 'Telephone Revenue',             'REVENUE',   'CREDIT', 'Other Revenue',               'G',   'Telephone Revenue',                  NULL,    250, false),
    ('11111111-1111-1111-1111-111111111111', '4600', 'Laundry Revenue',               'REVENUE',   'CREDIT', 'Other Revenue',               'G',   'Laundry Revenue',                    NULL,    260, false),
    ('11111111-1111-1111-1111-111111111111', '4700', 'Miscellaneous Revenue',         'REVENUE',   'CREDIT', 'Miscellaneous Revenue',       'G',   'Miscellaneous Revenue',              NULL,    270, false),
    ('11111111-1111-1111-1111-111111111111', '4800', 'Package Revenue',               'REVENUE',   'CREDIT', 'Rooms Revenue',               'E',   'Package Revenue',                    '4000',  280, false),
    ('11111111-1111-1111-1111-111111111111', '4900', 'Other Revenue (Unclassified)',  'REVENUE',   'CREDIT', 'Miscellaneous Revenue',       'G',   'Other Unclassified Revenue',         NULL,    290, false),

    -- ── EXPENSE (5xxx) ─────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', '5000', 'Departmental Expenses',         'EXPENSE',   'DEBIT',  'Departmental Expenses',       NULL,  'Total Departmental Expenses',        NULL,    300, false),
    ('11111111-1111-1111-1111-111111111111', '5100', 'Comp Expense',                  'EXPENSE',   'DEBIT',  'Complimentary Expense',       'I',   'Complimentary Room Expense',         '5000',  310, true),
    ('11111111-1111-1111-1111-111111111111', '5110', 'Rooms Departmental Expense',    'EXPENSE',   'DEBIT',  'Departmental Expenses',       'I',   'Rooms Departmental Expense',         '5000',  320, false),
    ('11111111-1111-1111-1111-111111111111', '5200', 'Commission Expense',            'EXPENSE',   'DEBIT',  'Sales & Marketing Expense',   'J',   'OTA Commission Expense',             '5000',  330, false),
    ('11111111-1111-1111-1111-111111111111', '5300', 'Allowance & Discount Expense',  'EXPENSE',   'DEBIT',  'Allowances',                  'K',   'Rate Allowances & Discounts',        '5000',  340, false),
    ('11111111-1111-1111-1111-111111111111', '5400', 'Bad Debt Expense',              'EXPENSE',   'DEBIT',  'Fixed Charges',               'L',   'Bad Debt / Write-off Expense',       '5000',  350, false),
    ('11111111-1111-1111-1111-111111111111', '5500', 'Late Checkout Fee Expense',     'EXPENSE',   'DEBIT',  'Departmental Expenses',       'I',   'Late Checkout Fee Expense',          '5000',  360, false),
    ('11111111-1111-1111-1111-111111111111', '5600', 'No-Show Fee Revenue Offset',    'EXPENSE',   'DEBIT',  'Rooms Revenue',               'E',   'No-Show Fee Offset',                 '5000',  370, false)

ON CONFLICT (tenant_id, account_code) DO NOTHING;

\echo '  [ref] gl_chart_of_accounts seeded successfully.'
\echo 'gl_chart_of_accounts table created successfully!'
