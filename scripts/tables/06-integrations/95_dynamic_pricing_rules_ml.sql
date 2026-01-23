-- =============================================
-- Dynamic Pricing Rules (ML) Table
-- =============================================
-- Description: ML-powered dynamic pricing rules and configurations
-- Dependencies: properties, room_types, ai_demand_predictions
-- Category: Revenue Management - AI/ML
-- =============================================

CREATE TABLE IF NOT EXISTS dynamic_pricing_rules_ml (
    -- Primary Key
    rule_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Rule Details
    rule_name VARCHAR(255) NOT NULL,
    rule_description TEXT,
    rule_priority INTEGER DEFAULT 0,

    -- Applicability
    room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
    apply_to_all_room_types BOOLEAN DEFAULT FALSE,

    applicable_market_segments TEXT[],
    applicable_booking_channels TEXT[],
    applicable_rate_codes TEXT[],

    -- Date Range
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Days of Week
    apply_monday BOOLEAN DEFAULT TRUE,
    apply_tuesday BOOLEAN DEFAULT TRUE,
    apply_wednesday BOOLEAN DEFAULT TRUE,
    apply_thursday BOOLEAN DEFAULT TRUE,
    apply_friday BOOLEAN DEFAULT TRUE,
    apply_saturday BOOLEAN DEFAULT TRUE,
    apply_sunday BOOLEAN DEFAULT TRUE,

    -- Pricing Strategy
    pricing_strategy VARCHAR(50) NOT NULL CHECK (pricing_strategy IN (
        'occupancy_based',
        'demand_based',
        'competitor_based',
        'time_based',
        'event_based',
        'hybrid_ml',
        'reinforcement_learning',
        'surge_pricing',
        'yield_optimization'
    )),

    -- ML Model Configuration
    ml_model_name VARCHAR(100),
    ml_model_version VARCHAR(50),
    ml_model_endpoint TEXT, -- API endpoint for real-time pricing

    use_reinforcement_learning BOOLEAN DEFAULT FALSE,
    learning_rate DECIMAL(5,4),
    exploration_rate DECIMAL(5,4), -- For RL models

    -- Base Rate Settings
    base_rate_source VARCHAR(50) CHECK (base_rate_source IN (
        'rack_rate',
        'bar_rate',
        'historical_avg',
        'competitor_avg',
        'custom'
    )),
    custom_base_rate DECIMAL(10,2),

    -- Price Boundaries
    min_rate DECIMAL(10,2) NOT NULL,
    max_rate DECIMAL(10,2) NOT NULL,
    floor_rate DECIMAL(10,2), -- Absolute minimum (never go below)
    ceiling_rate DECIMAL(10,2), -- Absolute maximum (never exceed)

    -- Occupancy-Based Rules
    occupancy_threshold_low DECIMAL(5,2) DEFAULT 40.00, -- Below this, decrease rates
    occupancy_threshold_medium DECIMAL(5,2) DEFAULT 70.00,
    occupancy_threshold_high DECIMAL(5,2) DEFAULT 85.00, -- Above this, increase rates

    low_occupancy_adjustment DECIMAL(5,2) DEFAULT -15.00, -- % adjustment
    medium_occupancy_adjustment DECIMAL(5,2) DEFAULT 0.00,
    high_occupancy_adjustment DECIMAL(5,2) DEFAULT 20.00,

    -- Booking Window (Days to Arrival)
    booking_window_rules JSONB, -- JSON: [{"days_out": 30, "adjustment": -10}, ...]

    last_minute_threshold_days INTEGER DEFAULT 3,
    last_minute_adjustment DECIMAL(5,2) DEFAULT -20.00,

    advance_booking_threshold_days INTEGER DEFAULT 60,
    advance_booking_adjustment DECIMAL(5,2) DEFAULT 10.00,

    -- Competitor-Based Pricing
    monitor_competitors BOOLEAN DEFAULT FALSE,
    competitor_ids UUID[], -- IDs of competitors to monitor
    competitor_positioning VARCHAR(50) CHECK (competitor_positioning IN (
        'at_parity',
        'below_market',
        'above_market',
        'premium',
        'discount'
    )),
    competitor_offset_percentage DECIMAL(5,2), -- +/- % vs competitor avg
    competitor_offset_amount DECIMAL(10,2), -- +/- fixed amount

    -- Event-Based Pricing
    event_impact_multiplier DECIMAL(5,2) DEFAULT 1.0,
    high_demand_events TEXT[], -- Array of event types
    low_demand_periods TEXT[],

    -- Day-of-Week Adjustments
    monday_adjustment DECIMAL(5,2) DEFAULT 0.00,
    tuesday_adjustment DECIMAL(5,2) DEFAULT 0.00,
    wednesday_adjustment DECIMAL(5,2) DEFAULT 0.00,
    thursday_adjustment DECIMAL(5,2) DEFAULT 0.00,
    friday_adjustment DECIMAL(5,2) DEFAULT 0.00,
    saturday_adjustment DECIMAL(5,2) DEFAULT 0.00,
    sunday_adjustment DECIMAL(5,2) DEFAULT 0.00,

    -- Length of Stay Pricing
    los_rules JSONB, -- JSON: [{"min_nights": 3, "discount": 10}, ...]

    -- Real-Time Adjustment Frequency
    adjustment_frequency VARCHAR(50) CHECK (adjustment_frequency IN (
        'real_time',
        'hourly',
        'every_4_hours',
        'daily',
        'weekly',
        'manual'
    )),
    last_adjustment_at TIMESTAMP WITHOUT TIME ZONE,

    -- Price Change Limits
    max_price_increase_per_day DECIMAL(5,2) DEFAULT 10.00, -- Max % increase per day
    max_price_decrease_per_day DECIMAL(5,2) DEFAULT 15.00, -- Max % decrease per day
    price_rounding_rule VARCHAR(50) CHECK (price_rounding_rule IN (
        'nearest_dollar',
        'nearest_5',
        'nearest_10',
        '0.99_ending',
        'no_rounding'
    )),

    -- Testing & Optimization
    ab_testing_enabled BOOLEAN DEFAULT FALSE,
    control_group_percentage DECIMAL(5,2) DEFAULT 20.00,
    test_variant VARCHAR(50),

    -- Performance Targets
    target_occupancy DECIMAL(5,2),
    target_adr DECIMAL(10,2),
    target_revpar DECIMAL(10,2),

    -- Override Settings
    allow_manual_override BOOLEAN DEFAULT TRUE,
    override_expiry_hours INTEGER DEFAULT 24,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_automated BOOLEAN DEFAULT FALSE, -- Auto-apply or require approval

    -- Performance Tracking
    total_applications INTEGER DEFAULT 0,
    successful_optimizations INTEGER DEFAULT 0,
    revenue_generated DECIMAL(12,2) DEFAULT 0.00,

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    version BIGINT DEFAULT 0,

    -- Constraints
    CHECK (min_rate <= max_rate),
    CHECK (floor_rate IS NULL OR floor_rate <= min_rate),
    CHECK (ceiling_rate IS NULL OR ceiling_rate >= max_rate)
);

COMMENT ON TABLE dynamic_pricing_rules_ml IS 'ML-powered dynamic pricing rules with reinforcement learning, A/B testing, and automated price optimization';
COMMENT ON COLUMN dynamic_pricing_rules_ml.pricing_strategy IS 'Type of ML pricing strategy: occupancy-based, demand-based, competitor-based, hybrid, RL';
COMMENT ON COLUMN dynamic_pricing_rules_ml.exploration_rate IS 'For reinforcement learning: balance between exploring new prices vs exploiting known good prices';
