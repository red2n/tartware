-- =====================================================
-- Table: loyalty_program_economics
-- Description: Aggregate tracking of loyalty point liability,
--              benefit delivery costs, and program profitability
-- Category: 03-bookings
-- Dependencies: properties
-- =====================================================
-- DEV DOC
-- Purpose: Captures periodic snapshots of loyalty program economics
-- for financial reporting. Tracks outstanding point liability (IFRS 15),
-- benefit delivery costs, redemption/breakage rates, and program ROI.
-- Populated by scheduled batch job or night audit process.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.loyalty_program_economics (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant Isolation
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Point Liability
    total_points_outstanding BIGINT NOT NULL DEFAULT 0,              -- All outstanding unredeemed points
    point_liability_value NUMERIC(14,2) NOT NULL DEFAULT 0,          -- Monetary value of outstanding points
    cost_per_point NUMERIC(8,4) NOT NULL DEFAULT 0,                  -- Cost per point for liability calculation

    -- Earning Metrics
    points_earned_period BIGINT NOT NULL DEFAULT 0,                  -- Points earned this period
    points_earned_value NUMERIC(14,2) NOT NULL DEFAULT 0,            -- Monetary value of points earned

    -- Redemption Metrics
    points_redeemed_period BIGINT NOT NULL DEFAULT 0,                -- Points redeemed this period
    points_redeemed_value NUMERIC(14,2) NOT NULL DEFAULT 0,          -- Monetary value of redemptions
    redemption_rate NUMERIC(6,4) NOT NULL DEFAULT 0,                 -- Percentage of points redeemed vs earned

    -- Expiry & Breakage
    points_expired_period BIGINT NOT NULL DEFAULT 0,                 -- Points expired this period
    breakage_rate NUMERIC(6,4) NOT NULL DEFAULT 0,                   -- Expected non-redemption rate

    -- Benefit Delivery Costs
    upgrade_cost NUMERIC(12,2) NOT NULL DEFAULT 0,                   -- Cost of room upgrades delivered
    amenity_cost NUMERIC(12,2) NOT NULL DEFAULT 0,                   -- Cost of amenity benefits
    late_checkout_cost NUMERIC(12,2) NOT NULL DEFAULT 0,             -- Revenue displacement from late checkouts
    total_benefit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,             -- Sum of all benefit costs

    -- Program ROI
    incremental_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,            -- Revenue attributed to loyalty program
    program_roi NUMERIC(8,4),                                        -- (incremental_revenue - total_cost) / total_cost

    -- Member Counts
    active_members INTEGER NOT NULL DEFAULT 0,                       -- Members with activity in period
    new_enrollments INTEGER NOT NULL DEFAULT 0,                      -- New program enrollments

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_loyalty_economics_period CHECK (period_end > period_start)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_economics_period
    ON public.loyalty_program_economics (tenant_id, property_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_loyalty_economics_tenant
    ON public.loyalty_program_economics (tenant_id);

-- ─── Comments ───────────────────────────────────────────────────────────────

COMMENT ON TABLE public.loyalty_program_economics IS 'Periodic snapshots of loyalty program financial metrics for IFRS 15 compliance and program ROI analysis';
COMMENT ON COLUMN public.loyalty_program_economics.point_liability_value IS 'Monetary value of outstanding points (IFRS 15 deferred revenue obligation)';
COMMENT ON COLUMN public.loyalty_program_economics.breakage_rate IS 'Expected percentage of points that will never be redeemed';
COMMENT ON COLUMN public.loyalty_program_economics.program_roi IS '(incremental_revenue - total_benefit_cost) / total_benefit_cost';

\echo 'loyalty_program_economics table created successfully!'
