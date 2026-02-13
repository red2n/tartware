-- =====================================================
-- 59_loyalty_tier_rules.sql
-- Loyalty tier qualification rules and benefits
-- Industry Standard: Tiered loyalty programs (qualification thresholds)
-- Pattern: Configuration table per tenant/program
-- Date: 2025-06-14
-- =====================================================

-- =====================================================
-- LOYALTY_TIER_RULES TABLE
-- Defines qualification criteria and benefits per tier
-- =====================================================

CREATE TABLE IF NOT EXISTS loyalty_tier_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),             -- Unique rule identifier
    tenant_id UUID NOT NULL,                                         -- Owning tenant
    property_id UUID,                                                -- Property-specific override (NULL = tenant-wide)

    -- Tier Definition
    tier_name VARCHAR(50) NOT NULL CHECK (tier_name IN (
        'bronze', 'silver', 'gold', 'platinum', 'diamond', 'elite'
    )),                                                              -- Tier level name
    tier_rank INTEGER NOT NULL,                                      -- Numeric rank for ordering (1 = lowest)
    display_name VARCHAR(100),                                       -- User-facing tier label

    -- Qualification Thresholds (any combination, OR logic)
    min_nights INTEGER NOT NULL DEFAULT 0,                           -- Minimum qualifying nights
    min_stays INTEGER NOT NULL DEFAULT 0,                            -- Minimum qualifying stays
    min_points INTEGER NOT NULL DEFAULT 0,                           -- Minimum qualifying points
    min_spend DECIMAL(12,2) NOT NULL DEFAULT 0,                      -- Minimum qualifying spend
    qualification_period_months INTEGER NOT NULL DEFAULT 12,          -- Rolling window for qualification

    -- Points Configuration
    points_per_dollar DECIMAL(6,2) NOT NULL DEFAULT 1.00,            -- Base earning rate
    bonus_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,             -- Multiplier on base earn rate
    points_expiry_months INTEGER,                                    -- Months until earned points expire (NULL = no expiry)

    -- Benefits
    benefits JSONB NOT NULL DEFAULT '{}'::jsonb,                     -- Structured benefits JSON
    welcome_bonus_points INTEGER DEFAULT 0,                          -- Points awarded on tier upgrade

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                         -- Enable/disable this rule

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,   -- Row creation
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,   -- Row last update
    created_by UUID,                                                 -- Creator
    updated_by UUID                                                  -- Last updater
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_tier_rules_tenant_tier
    ON loyalty_tier_rules (tenant_id, tier_name)
    WHERE property_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_tier_rules_property_tier
    ON loyalty_tier_rules (tenant_id, property_id, tier_name)
    WHERE property_id IS NOT NULL;

COMMENT ON TABLE loyalty_tier_rules IS 'Defines qualification criteria and benefits for each loyalty tier. Supports tenant-wide and property-specific overrides.';
COMMENT ON COLUMN loyalty_tier_rules.tier_rank IS 'Numeric rank for sorting: 1=bronze, 2=silver, etc.';
COMMENT ON COLUMN loyalty_tier_rules.qualification_period_months IS 'Rolling window in months during which qualifying activity is counted';
COMMENT ON COLUMN loyalty_tier_rules.points_per_dollar IS 'Base points earned per unit of currency spent';
COMMENT ON COLUMN loyalty_tier_rules.bonus_multiplier IS 'Multiplier applied to base earning rate for this tier (e.g., 2.0 = double points)';
COMMENT ON COLUMN loyalty_tier_rules.benefits IS 'JSON: {late_checkout, room_upgrade, free_wifi, lounge_access, free_breakfast, etc.}';

\echo 'loyalty_tier_rules table created successfully!'
