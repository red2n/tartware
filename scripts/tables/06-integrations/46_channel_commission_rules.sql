-- =====================================================
-- Channel Commission Rules Table
-- =====================================================
-- Purpose: Manage commission structures and calculations for OTA channels
-- Key Features:
--   - Flexible commission models
--   - Tiered commission structures
--   - Seasonal adjustments
--   - Performance-based incentives
-- =====================================================

CREATE TABLE IF NOT EXISTS channel_commission_rules (
    -- Primary Key
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Channel Information
    channel_name VARCHAR(100) NOT NULL,
    ota_config_id UUID,

    -- Rule Details
    rule_name VARCHAR(200) NOT NULL,
    rule_code VARCHAR(50) UNIQUE,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('standard', 'tiered', 'performance_based', 'seasonal', 'promotional', 'volume_based')),

    -- Commission Structure
    commission_model VARCHAR(50) NOT NULL CHECK (commission_model IN ('percentage', 'flat_fee', 'per_room_night', 'hybrid', 'net_rate')),
    base_commission_percent DECIMAL(5,2),
    base_commission_amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Tiered Structure
    has_tiers BOOLEAN DEFAULT FALSE,
    tier_structure JSONB, -- [{min_bookings, max_bookings, commission_percent, commission_amount}]
    tier_basis VARCHAR(50) CHECK (tier_basis IN ('bookings', 'revenue', 'room_nights', 'properties', 'quarterly', 'annual')),

    -- Performance Bonuses
    performance_bonuses JSONB, -- [{metric, threshold, bonus_percent, bonus_amount}]
    volume_discounts JSONB, -- [{min_volume, max_volume, discount_percent}]

    -- Applicability
    applies_to_room_types UUID[], -- NULL means all room types
    applies_to_rate_plans UUID[], -- NULL means all rate plans
    excluded_room_types UUID[],
    excluded_rate_plans UUID[],

    -- Date Ranges
    effective_from DATE NOT NULL,
    effective_until DATE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Seasonal Adjustments
    has_seasonal_variations BOOLEAN DEFAULT FALSE,
    seasonal_rules JSONB, -- [{season_name, start_date, end_date, commission_adjustment_percent}]

    -- Special Conditions
    minimum_stay_nights INTEGER,
    maximum_stay_nights INTEGER,
    advance_booking_days INTEGER,
    blackout_dates DATE[],
    applies_to_weekdays BOOLEAN DEFAULT TRUE,
    applies_to_weekends BOOLEAN DEFAULT TRUE,

    -- Calculation Settings
    calculate_on VARCHAR(50) NOT NULL DEFAULT 'gross_revenue' CHECK (calculate_on IN ('gross_revenue', 'net_revenue', 'room_revenue', 'total_booking_value', 'base_rate')),
    include_taxes BOOLEAN DEFAULT FALSE,
    include_fees BOOLEAN DEFAULT TRUE,
    include_services BOOLEAN DEFAULT FALSE,

    -- Payment Terms
    payment_frequency VARCHAR(50) CHECK (payment_frequency IN ('per_booking', 'weekly', 'bi_weekly', 'monthly', 'quarterly')),
    payment_day_of_month INTEGER CHECK (payment_day_of_month BETWEEN 1 AND 31),
    payment_terms_days INTEGER DEFAULT 30,

    -- Caps and Limits
    max_commission_per_booking DECIMAL(10,2),
    min_commission_per_booking DECIMAL(10,2),
    max_commission_per_month DECIMAL(10,2),
    commission_cap_type VARCHAR(50) CHECK (commission_cap_type IN ('per_booking', 'per_month', 'per_quarter', 'per_year', 'none')),

    -- Contract Details
    contract_id VARCHAR(100),
    contract_start_date DATE,
    contract_end_date DATE,
    auto_renewal BOOLEAN DEFAULT FALSE,
    renewal_notice_days INTEGER,

    -- Overrides
    can_be_overridden BOOLEAN DEFAULT FALSE,
    override_requires_approval BOOLEAN DEFAULT TRUE,
    approval_roles VARCHAR(100)[],

    -- Tracking
    bookings_processed INTEGER DEFAULT 0,
    total_commission_earned DECIMAL(12,2) DEFAULT 0.00,
    last_calculation_date DATE,
    next_review_date DATE,

    -- Audit
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Priority (when multiple rules apply)
    priority INTEGER DEFAULT 100,
    conflict_resolution VARCHAR(50) DEFAULT 'highest_priority' CHECK (conflict_resolution IN ('highest_priority', 'lowest_commission', 'highest_commission', 'most_recent')),

    -- Metadata
    description TEXT,
    internal_notes TEXT,
    metadata JSONB,
    tags VARCHAR(100)[],

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


-- Comments
COMMENT ON TABLE channel_commission_rules IS 'Manages commission structures and calculation rules for OTA channels';
COMMENT ON COLUMN channel_commission_rules.tier_structure IS 'JSON array defining tiered commission rates based on volume';
COMMENT ON COLUMN channel_commission_rules.performance_bonuses IS 'JSON array of performance-based bonus structures';
COMMENT ON COLUMN channel_commission_rules.calculate_on IS 'Base amount on which commission is calculated';
COMMENT ON COLUMN channel_commission_rules.conflict_resolution IS 'Strategy when multiple rules apply to same booking';

\echo 'channel_commission_rules table created successfully!'
