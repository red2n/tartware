-- =====================================================
-- Pricing Rules Table
-- =====================================================
-- Purpose: Dynamic pricing rules engine for revenue optimization
-- Key Features:
--   - Condition-based pricing
--   - Automated rate adjustments
--   - Rule priority management
--   - A/B testing support
-- =====================================================

CREATE TABLE IF NOT EXISTS pricing_rules (
    -- Primary Key
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Rule Identification
    rule_name VARCHAR(200) NOT NULL,
    rule_code VARCHAR(100) UNIQUE,
    description TEXT,

    -- Rule Type
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN (
        'occupancy_based', 'demand_based', 'day_of_week', 'seasonal',
        'event_driven', 'length_of_stay', 'advance_purchase', 'last_minute',
        'competitor_based', 'segment_based', 'channel_based', 'time_based', 'custom'
    )),
    rule_category VARCHAR(100) CHECK (rule_category IN ('dynamic', 'promotional', 'restriction', 'yield', 'strategic')),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_paused BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 100, -- Lower number = higher priority

    -- Applicability
    applies_to_room_types UUID[], -- NULL means all
    applies_to_rate_plans UUID[], -- NULL means all
    applies_to_channels VARCHAR(100)[], -- NULL means all
    applies_to_segments VARCHAR(100)[], -- NULL means all
    excluded_room_types UUID[],
    excluded_rate_plans UUID[],

    -- Date Range
    effective_from DATE NOT NULL,
    effective_until DATE,

    -- Day of Week
    applies_monday BOOLEAN DEFAULT TRUE,
    applies_tuesday BOOLEAN DEFAULT TRUE,
    applies_wednesday BOOLEAN DEFAULT TRUE,
    applies_thursday BOOLEAN DEFAULT TRUE,
    applies_friday BOOLEAN DEFAULT TRUE,
    applies_saturday BOOLEAN DEFAULT TRUE,
    applies_sunday BOOLEAN DEFAULT TRUE,

    -- Time Restrictions
    booking_window_start_days INTEGER, -- How many days before arrival
    booking_window_end_days INTEGER,
    applies_to_weekends_only BOOLEAN DEFAULT FALSE,
    applies_to_weekdays_only BOOLEAN DEFAULT FALSE,

    -- Conditions (ALL must be met)
    conditions JSONB NOT NULL, -- {occupancy: {operator: ">=", value: 80}, lead_time: {...}}
    /*
    Example conditions structure:
    {
        "occupancy_percent": {"operator": ">=", "value": 80},
        "days_until_arrival": {"operator": "<=", "value": 7},
        "demand_level": {"operator": "in", "value": ["high", "very_high"]},
        "competitor_rate_position": {"operator": "=", "value": "lower"},
        "length_of_stay": {"operator": ">=", "value": 3}
    }
    */

    -- Pricing Action
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
        'percentage_increase', 'percentage_decrease', 'fixed_amount_increase',
        'fixed_amount_decrease', 'set_to_amount', 'set_to_market_rate',
        'match_competitor', 'set_to_bar'
    )),
    adjustment_value DECIMAL(10,2) NOT NULL,
    adjustment_cap_min DECIMAL(10,2), -- Minimum rate after adjustment
    adjustment_cap_max DECIMAL(10,2), -- Maximum rate after adjustment

    -- Rounding
    round_to_nearest DECIMAL(5,2), -- e.g., 0.99 for $99.99
    rounding_method VARCHAR(20) CHECK (rounding_method IN ('up', 'down', 'nearest')),

    -- Length of Stay Requirements
    min_length_of_stay INTEGER,
    max_length_of_stay INTEGER,
    los_discount_structure JSONB, -- {3: 5%, 7: 10%, 14: 15%}

    -- Restrictions to Apply
    apply_min_stay_restriction INTEGER,
    apply_max_stay_restriction INTEGER,
    apply_closed_to_arrival BOOLEAN DEFAULT FALSE,
    apply_closed_to_departure BOOLEAN DEFAULT FALSE,
    apply_stop_sell BOOLEAN DEFAULT FALSE,

    -- Combinability
    can_combine_with_other_rules BOOLEAN DEFAULT TRUE,
    mutually_exclusive_with_rules UUID[],
    must_combine_with_rules UUID[],

    -- Priority & Conflict Resolution
    conflict_resolution VARCHAR(50) DEFAULT 'highest_priority' CHECK (conflict_resolution IN (
        'highest_priority', 'lowest_rate', 'highest_rate', 'first_match', 'last_match', 'combine'
    )),

    -- Performance Tracking
    times_applied INTEGER DEFAULT 0,
    total_revenue_impact DECIMAL(12,2) DEFAULT 0.00,
    bookings_influenced INTEGER DEFAULT 0,
    average_rate_adjustment DECIMAL(10,2),
    last_applied_at TIMESTAMP WITH TIME ZONE,

    -- Effectiveness Metrics
    conversion_rate DECIMAL(5,2),
    revenue_per_available_room DECIMAL(10,2),
    occupancy_lift_percent DECIMAL(5,2),
    effectiveness_score DECIMAL(5,2), -- 0-100

    -- A/B Testing
    is_ab_test BOOLEAN DEFAULT FALSE,
    ab_test_variant VARCHAR(50),
    ab_test_control_group_percent INTEGER CHECK (ab_test_control_group_percent BETWEEN 0 AND 100),
    ab_test_start_date DATE,
    ab_test_end_date DATE,

    -- Automation
    auto_activate BOOLEAN DEFAULT FALSE,
    auto_deactivate BOOLEAN DEFAULT FALSE,
    auto_adjust_based_on_performance BOOLEAN DEFAULT FALSE,

    -- Notifications
    notify_on_activation BOOLEAN DEFAULT FALSE,
    notify_on_significant_impact BOOLEAN DEFAULT FALSE,
    notification_recipients UUID[],

    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(50) DEFAULT 'approved' CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Override
    can_be_overridden BOOLEAN DEFAULT TRUE,
    override_requires_approval BOOLEAN DEFAULT FALSE,
    override_count INTEGER DEFAULT 0,

    -- Audit Trail
    last_modified_reason TEXT,
    change_history JSONB, -- [{timestamp, user, field, old_value, new_value}]

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,

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
COMMENT ON TABLE pricing_rules IS 'Dynamic pricing rules engine for automated rate adjustments based on conditions';
COMMENT ON COLUMN pricing_rules.conditions IS 'JSON object defining conditions that must be met for rule to apply';
COMMENT ON COLUMN pricing_rules.conflict_resolution IS 'Strategy when multiple rules match: highest_priority, lowest_rate, highest_rate, etc';
COMMENT ON COLUMN pricing_rules.adjustment_type IS 'Type of rate adjustment: percentage_increase, percentage_decrease, set_to_amount, etc';
COMMENT ON COLUMN pricing_rules.can_combine_with_other_rules IS 'Whether this rule can be applied along with other rules';
