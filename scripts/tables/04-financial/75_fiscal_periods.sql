-- =====================================================
-- 75_fiscal_periods.sql
-- Fiscal & Accounting Period Management
-- Industry Standard: OPERA (FISCAL_YEAR + PERIODS),
--                    Protel (GESCHAEFTSJAHR), RMS (accounting_periods)
-- Pattern: Period-based financial close with soft/hard lock
-- Date: 2026-03-12
-- =====================================================

\c tartware

-- =====================================================
-- FISCAL_PERIODS TABLE
-- Defines fiscal years and accounting periods (monthly)
-- for financial reporting and month-end close tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS fiscal_periods (
    -- Primary Key
    fiscal_period_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Stable identifier for the fiscal period

    -- Multi-tenancy
    tenant_id UUID NOT NULL, -- Owning tenant
    property_id UUID NOT NULL, -- Owning property (periods are per-property)

    -- Fiscal Year
    fiscal_year INTEGER NOT NULL, -- Calendar year the fiscal year maps to (e.g. 2026)
    fiscal_year_start DATE NOT NULL, -- First day of the fiscal year
    fiscal_year_end DATE NOT NULL, -- Last day of the fiscal year

    -- Period Info
    period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 13), -- 1-12 monthly, 13 year-end adjustments
    period_name VARCHAR(50) NOT NULL, -- Display name (e.g. 'January 2026', 'Period 13 Adj.')
    period_start DATE NOT NULL, -- First day of this accounting period
    period_end DATE NOT NULL, -- Last day of this accounting period

    -- Status
    period_status VARCHAR(20) NOT NULL DEFAULT 'OPEN' -- Lifecycle: FUTURE → OPEN → SOFT_CLOSE → CLOSED → LOCKED
        CHECK (period_status IN ('FUTURE', 'OPEN', 'SOFT_CLOSE', 'CLOSED', 'LOCKED')),

    -- Close Information
    closed_at TIMESTAMP, -- When period was closed to normal posting
    closed_by UUID, -- User who performed the close
    close_notes TEXT, -- Reason/comments for the close action

    -- Soft Close (allows adjustments with approval)
    soft_closed_at TIMESTAMP, -- When period entered soft-close state
    soft_closed_by UUID, -- User who initiated the soft close

    -- Lock (final — no changes allowed)
    locked_at TIMESTAMP, -- When period was permanently locked
    locked_by UUID, -- User who locked the period

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT FALSE, -- Whether GL reconciliation is complete
    reconciled_at TIMESTAMP, -- When reconciliation was completed
    reconciled_by UUID, -- User who performed reconciliation

    -- Revenue Summary (aggregated at period close)
    total_revenue DECIMAL(14, 2) DEFAULT 0.00, -- Total revenue posted in this period
    total_expenses DECIMAL(14, 2) DEFAULT 0.00, -- Total expenses posted in this period
    net_income DECIMAL(14, 2) DEFAULT 0.00, -- Revenue minus expenses for the period

    -- Metadata
    notes TEXT, -- Free-form notes for auditors
    metadata JSONB DEFAULT '{}'::jsonb, -- Extensibility for custom attributes

    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uk_fiscal_periods_tenant_property_year_period
        UNIQUE (tenant_id, property_id, fiscal_year, period_number),

    CONSTRAINT chk_fiscal_periods_dates
        CHECK (period_start <= period_end),

    CONSTRAINT chk_fiscal_year_dates
        CHECK (fiscal_year_start <= fiscal_year_end)
);

COMMENT ON TABLE fiscal_periods IS 'Fiscal year periods for accounting close and financial reporting. Period 13 is reserved for year-end adjustments.';
COMMENT ON COLUMN fiscal_periods.fiscal_year IS 'Calendar year the fiscal year maps to';
COMMENT ON COLUMN fiscal_periods.period_number IS '1-12 for monthly periods, 13 for year-end adjustments';
COMMENT ON COLUMN fiscal_periods.period_name IS 'Display name for the period (e.g. January 2026)';
COMMENT ON COLUMN fiscal_periods.period_status IS 'FUTURE (not yet active), OPEN (current), SOFT_CLOSE (adjustments with approval), CLOSED (final), LOCKED (immutable)';
COMMENT ON COLUMN fiscal_periods.is_reconciled IS 'Whether GL reconciliation has been completed for this period';
COMMENT ON COLUMN fiscal_periods.total_revenue IS 'Aggregated revenue for the period, computed at close time';
COMMENT ON COLUMN fiscal_periods.total_expenses IS 'Aggregated expenses for the period, computed at close time';
COMMENT ON COLUMN fiscal_periods.net_income IS 'Revenue minus expenses, computed at close time';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_tenant
    ON fiscal_periods(tenant_id, property_id, fiscal_year DESC, period_number)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_status
    ON fiscal_periods(property_id, period_status, period_start)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_open
    ON fiscal_periods(property_id, period_start, period_end)
    WHERE is_deleted = false AND period_status = 'OPEN';

\echo 'fiscal_periods table created successfully!'
