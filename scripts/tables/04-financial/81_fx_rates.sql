-- =====================================================
-- 81_fx_rates.sql
-- Daily FX Rate Reference Table
-- Industry Standard: USALI 12th Edition §9.3, BA §13.5
-- Pattern: Reference data — daily snapshot, immutable after insert
-- Date: 2025-01-01
-- =====================================================

-- =====================================================
-- FX_RATES TABLE
-- Per-date, per-currency-pair exchange rate snapshots for ACCT-13
-- FX Rate Locking (multi-currency PMS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fx_rates (
    -- Primary Key
    rate_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant scoping (null = global/shared rate applies to all tenants)
    tenant_id       UUID REFERENCES public.tenants(tenant_id), -- NULL = system-wide default

    -- Currency pair
    from_currency   CHAR(3)          NOT NULL,              -- ISO 4217 source currency (e.g. EUR)
    to_currency     CHAR(3)          NOT NULL,              -- ISO 4217 target currency (e.g. USD)

    -- Rate
    rate            DECIMAL(12, 6)   NOT NULL,              -- from_currency / to_currency (1 EUR = X USD)
    rate_date       DATE             NOT NULL,              -- The calendar date this rate applies to

    -- Source information
    rate_source     VARCHAR(60)      NOT NULL DEFAULT 'MANUAL', -- MANUAL, ECB, OPEN_EXCHANGE_RATES, etc.
    rate_source_ref VARCHAR(200),                           -- External reference or batch ID

    -- Audit
    created_at      TIMESTAMP        NOT NULL DEFAULT NOW(),
    created_by      UUID,

    -- Constraints
    CONSTRAINT chk_fx_rate_positive    CHECK (rate > 0),
    CONSTRAINT chk_fx_rate_diff_ccy    CHECK (from_currency <> to_currency),
    CONSTRAINT chk_fx_from_len         CHECK (LENGTH(from_currency) = 3),
    CONSTRAINT chk_fx_to_len           CHECK (LENGTH(to_currency) = 3),

    -- Unique: one rate per tenant/date/pair (NULL tenant = global)
    CONSTRAINT uq_fx_rates_date_pair   UNIQUE NULLS NOT DISTINCT (tenant_id, rate_date, from_currency, to_currency)
);

COMMENT ON TABLE fx_rates IS 'Daily FX rate snapshots used to lock exchange rates at charge/payment posting time (ACCT-13).';
COMMENT ON COLUMN fx_rates.tenant_id IS 'Tenant this rate applies to; NULL = system-wide default used when no tenant-specific rate exists.';
COMMENT ON COLUMN fx_rates.rate IS 'Exchange rate: 1 from_currency = rate to_currency. E.g. from=EUR, to=USD, rate=1.08 means 1 EUR = 1.08 USD.';
COMMENT ON COLUMN fx_rates.rate_date IS 'Calendar date for which this rate is valid (one rate per day per pair per tenant).';
COMMENT ON COLUMN fx_rates.rate_source IS 'Origin of the rate: MANUAL (hotel staff), ECB, OPEN_EXCHANGE_RATES, or other feed.';

-- Indexes for fast lookup by date + currency pair
CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup
    ON public.fx_rates (rate_date, from_currency, to_currency);

CREATE INDEX IF NOT EXISTS idx_fx_rates_tenant_date
    ON public.fx_rates (tenant_id, rate_date)
    WHERE tenant_id IS NOT NULL;

\echo 'fx_rates table created successfully!'
