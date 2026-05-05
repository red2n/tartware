-- =====================================================
-- 12_charge_code_gl_mapping.sql
-- Charge Code → GL Account Mapping
-- Industry Standard: USALI 12th Edition
-- Pattern: Reference data; one row per charge_code maps
--   to its default debit and credit GL accounts.
--   The billing service uses this table at GL batch
--   rebuild time to produce USALI-correct double entries.
-- Date: 2026-04-29
-- =====================================================

-- =====================================================
-- CHARGE_CODE_GL_MAPPING TABLE
-- Maps PMS charge codes to their USALI GL accounts.
-- A charge posting produces:
--   debit_account  → normally the Guest Ledger (1100)
--   credit_account → the revenue or liability account
-- For void/reversal the sides are swapped automatically
-- by the GL batch builder.
-- =====================================================

\c tartware

\echo '  [ref] Creating charge_code_gl_mapping table...'

CREATE TABLE IF NOT EXISTS charge_code_gl_mapping (
    mapping_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id       UUID        NOT NULL,   -- Owning tenant

    -- Source
    charge_code     VARCHAR(50) NOT NULL,   -- Matches charge_codes.code

    -- GL Accounts (USALI)
    debit_account   VARCHAR(20) NOT NULL,   -- Debit side of the double entry (usually 1100)
    credit_account  VARCHAR(20) NOT NULL,   -- Credit side (revenue or liability account)

    -- Classification
    usali_category  VARCHAR(100),           -- USALI revenue/expense category label
    department_code VARCHAR(20),            -- Department for cost-center reporting

    -- State
    is_active       BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_at      TIMESTAMPTZ,
    updated_by      UUID,

    -- Soft Delete
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID,

    CONSTRAINT uq_charge_code_gl UNIQUE (tenant_id, charge_code)
);

COMMENT ON TABLE charge_code_gl_mapping IS 'Maps PMS charge codes to USALI GL debit/credit account pairs for double-entry posting';
COMMENT ON COLUMN charge_code_gl_mapping.debit_account IS 'GL account debited when this charge is posted (normally 1100 Guest Ledger)';
COMMENT ON COLUMN charge_code_gl_mapping.credit_account IS 'GL account credited when this charge is posted (revenue or liability account)';

CREATE INDEX IF NOT EXISTS idx_charge_code_gl_tenant_code
    ON charge_code_gl_mapping (tenant_id, charge_code)
    WHERE is_deleted = false;

GRANT SELECT, INSERT, UPDATE ON charge_code_gl_mapping TO tartware_app;

-- Row-Level Security
ALTER TABLE charge_code_gl_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_code_gl_mapping FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_charge_code_gl_mapping
    ON charge_code_gl_mapping
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- =====================================================
-- SEED: Default USALI-aligned mappings
-- Covers all charge codes seeded in 07_charge_codes.sql
-- =====================================================
\echo '  [ref] Seeding charge_code_gl_mapping...'

INSERT INTO charge_code_gl_mapping
    (tenant_id, charge_code, debit_account, credit_account, usali_category, department_code)
VALUES
    -- ── Rooms ──────────────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', 'ROOM',             '1100', '4000', 'Rooms Revenue',               'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'ROOM_TAX',         '1100', '2100', 'Taxes',                       'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'ROOM_UPGRADE',     '1100', '4000', 'Rooms Revenue',               'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'LATE_CHECKOUT',    '1100', '4000', 'Rooms Revenue',               'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'EARLY_CHECKIN',    '1100', '4000', 'Rooms Revenue',               'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'NO_SHOW',          '1100', '4000', 'Rooms Revenue',               'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'CANCEL_FEE',       '1100', '4000', 'Rooms Revenue',               'ROOMS'),
    -- ── Packages ───────────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', 'PACKAGE',          '1100', '4800', 'Rooms Revenue',               'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'PACKAGE_FB',       '1100', '4100', 'Food & Beverage Revenue',     'FB'),
    ('11111111-1111-1111-1111-111111111111', 'PACKAGE_SPA',      '1100', '4300', 'Spa Revenue',                 'SPA'),
    -- ── Food & Beverage ────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', 'MINIBAR',          '1100', '4100', 'Food & Beverage Revenue',     'FB'),
    ('11111111-1111-1111-1111-111111111111', 'RESTAURANT',       '1100', '4100', 'Food & Beverage Revenue',     'FB'),
    ('11111111-1111-1111-1111-111111111111', 'ROOM_SERVICE',     '1100', '4130', 'Food & Beverage Revenue',     'FB'),
    ('11111111-1111-1111-1111-111111111111', 'BAR',              '1100', '4120', 'Food & Beverage Revenue',     'FB'),
    ('11111111-1111-1111-1111-111111111111', 'BANQUET',          '1100', '4100', 'Food & Beverage Revenue',     'FB'),
    -- ── Spa ────────────────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', 'SPA',              '1100', '4300', 'Spa Revenue',                 'SPA'),
    ('11111111-1111-1111-1111-111111111111', 'SPA_TAX',          '1100', '2100', 'Taxes',                       'SPA'),
    -- ── Parking & Other ────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', 'PARKING',          '1100', '4400', 'Other Revenue',               'OTHER'),
    ('11111111-1111-1111-1111-111111111111', 'TELEPHONE',        '1100', '4500', 'Other Revenue',               'OTHER'),
    ('11111111-1111-1111-1111-111111111111', 'LAUNDRY',          '1100', '4600', 'Other Revenue',               'OTHER'),
    ('11111111-1111-1111-1111-111111111111', 'RESORT_FEE',       '1100', '4200', 'Other Revenue - Fees',        'OTHER'),
    ('11111111-1111-1111-1111-111111111111', 'MISC',             '1100', '4900', 'Miscellaneous Revenue',       'OTHER'),
    -- ── Comp (Gross Revenue + Offset) ──────────────────────────────────────
    -- Comp charges debit 5100 (Comp Expense) and credit 4000 (Rooms Revenue)
    ('11111111-1111-1111-1111-111111111111', 'COMP',             '5100', '4000', 'Complimentary Expense',       'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'COMP_FB',          '5100', '4100', 'Complimentary Expense',       'FB'),
    -- ── Adjustments ────────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', 'ADJUSTMENT',       '1100', '4900', 'Miscellaneous Revenue',       'OTHER'),
    ('11111111-1111-1111-1111-111111111111', 'ALLOWANCE',        '5300', '1100', 'Allowances',                  'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'WRITE_OFF',        '5400', '1200', 'Fixed Charges',               'OTHER'),
    -- ── Taxes (generic) ────────────────────────────────────────────────────
    ('11111111-1111-1111-1111-111111111111', 'TAX',              '1100', '2100', 'Taxes',                       'OTHER'),
    ('11111111-1111-1111-1111-111111111111', 'OCCUPANCY_TAX',    '1100', '2110', 'Taxes',                       'ROOMS'),
    ('11111111-1111-1111-1111-111111111111', 'TOURISM_LEVY',     '1100', '2120', 'Taxes',                       'OTHER'),
    -- ── Payments (for reference — payment GL is handled separately) ─────────
    ('11111111-1111-1111-1111-111111111111', 'DEPOSIT',          '1100', '2200', 'Advance Deposits',            'ROOMS')

ON CONFLICT (tenant_id, charge_code) DO NOTHING;

\echo '  [ref] charge_code_gl_mapping seeded successfully.'
\echo 'charge_code_gl_mapping table created successfully!'
