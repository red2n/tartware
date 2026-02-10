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
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique rule identifier

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Rule Identification
rule_name VARCHAR(200) NOT NULL, -- Display name for easy reference
rule_code VARCHAR(100) UNIQUE, -- Optional code (used in APIs/integrations)
description TEXT, -- Free-form explanation of the rule

-- Rule Type
rule_type VARCHAR(50) NOT NULL CHECK (
    rule_type IN (
        'occupancy_based',
        'demand_based',
        'day_of_week',
        'seasonal',
        'event_driven',
        'length_of_stay',
        'advance_purchase',
        'last_minute',
        'competitor_based',
        'segment_based',
        'channel_based',
        'time_based',
        'custom'
    )
),
rule_category VARCHAR(100) CHECK (
    rule_category IN (
        'dynamic',
        'promotional',
        'restriction',
        'yield',
        'strategic'
    )
),

-- Status
is_active BOOLEAN DEFAULT TRUE, -- Master enable flag
is_paused BOOLEAN DEFAULT FALSE, -- Temporarily disable without removing
priority INTEGER DEFAULT 100, -- Lower number = higher priority

-- Applicability
applies_to_room_types UUID [], -- NULL means all
applies_to_rate_plans UUID [], -- Target rate plans
applies_to_channels VARCHAR(100) [], -- Applicable sales channels
applies_to_segments VARCHAR(100) [], -- Target customer segments
excluded_room_types UUID [], -- Explicit exclusions
excluded_rate_plans UUID [], -- Excluded rate plans

-- Date Range
effective_from DATE NOT NULL, -- Rule start date
effective_until DATE, -- Rule end date

-- Day of Week
applies_monday BOOLEAN DEFAULT TRUE, -- Applies on Monday
applies_tuesday BOOLEAN DEFAULT TRUE, -- Applies on Tuesday
applies_wednesday BOOLEAN DEFAULT TRUE, -- Applies on Wednesday
applies_thursday BOOLEAN DEFAULT TRUE, -- Applies on Thursday
applies_friday BOOLEAN DEFAULT TRUE, -- Applies on Friday
applies_saturday BOOLEAN DEFAULT TRUE, -- Applies on Saturday
applies_sunday BOOLEAN DEFAULT TRUE, -- Applies on Sunday

-- Time Restrictions
booking_window_start_days INTEGER, -- Earliest arrival lead time
booking_window_end_days INTEGER, -- Latest arrival lead time
applies_to_weekends_only BOOLEAN DEFAULT FALSE, -- Weekend-only flag
applies_to_weekdays_only BOOLEAN DEFAULT FALSE, -- Weekday-only flag

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
adjustment_type VARCHAR(50) NOT NULL CHECK (
    adjustment_type IN (
        'percentage_increase',
        'percentage_decrease',
        'fixed_amount_increase',
        'fixed_amount_decrease',
        'set_to_amount',
        'set_to_market_rate',
        'match_competitor',
        'set_to_bar'
    )
),
adjustment_value DECIMAL(10, 2) NOT NULL, -- Magnitude of adjustment
adjustment_cap_min DECIMAL(10, 2), -- Minimum rate after adjustment
adjustment_cap_max DECIMAL(10, 2), -- Maximum rate after adjustment

-- Rounding
round_to_nearest DECIMAL(5, 2), -- e.g., 0.99 for $99.99
rounding_method VARCHAR(20) CHECK (
    rounding_method IN ('up', 'down', 'nearest')
), -- Rounding direction

-- Length of Stay Requirements
min_length_of_stay INTEGER, -- LOS prerequisites
max_length_of_stay INTEGER, -- Maximum length of stay
los_discount_structure JSONB, -- {3: 5%, 7: 10%, 14: 15%}

-- Restrictions to Apply
apply_min_stay_restriction INTEGER, -- Restrictions triggered by rule
apply_max_stay_restriction INTEGER, -- Restrictions triggered by rule
apply_closed_to_arrival BOOLEAN DEFAULT FALSE, -- Close to arrival restriction triggered by rule
apply_closed_to_departure BOOLEAN DEFAULT FALSE, -- Close to departure restriction triggered by rule
apply_stop_sell BOOLEAN DEFAULT FALSE, -- Stop sell restriction triggered by rule

-- Combinability
can_combine_with_other_rules BOOLEAN DEFAULT TRUE, -- Allow stacking
mutually_exclusive_with_rules UUID [], -- Rules that cannot co-exist
must_combine_with_rules UUID [], -- Rules that must fire together

-- Priority & Conflict Resolution
conflict_resolution VARCHAR(50) DEFAULT 'highest_priority' CHECK (
    conflict_resolution IN (
        'highest_priority',
        'lowest_rate',
        'highest_rate',
        'first_match',
        'last_match',
        'combine'
    )
),

-- Performance Tracking
times_applied INTEGER DEFAULT 0, -- Number of times rule has been applied
total_revenue_impact DECIMAL(12, 2) DEFAULT 0.00, -- Cumulative revenue impact
bookings_influenced INTEGER DEFAULT 0, -- Number of bookings affected
average_rate_adjustment DECIMAL(10, 2), -- Average rate change applied
last_applied_at TIMESTAMP WITH TIME ZONE, -- Last application timestamp
-- Effectiveness Metrics
conversion_rate DECIMAL(5, 2), -- Percentage of influenced views leading to bookings
revenue_per_available_room DECIMAL(10, 2), -- RevPAR impact
occupancy_lift_percent DECIMAL(5, 2), -- Occupancy increase due to rule
effectiveness_score DECIMAL(5, 2), -- 0-100

-- A/B Testing
is_ab_test BOOLEAN DEFAULT FALSE, -- Indicates if rule is part of an A/B test
ab_test_variant VARCHAR(50), -- Variant name (e.g., 'A', 'B', 'Control')
ab_test_control_group_percent INTEGER CHECK (
    ab_test_control_group_percent BETWEEN 0 AND 100
), -- Control group size
ab_test_start_date DATE, -- A/B test start date
ab_test_end_date DATE, -- A/B test end date

-- Automation
auto_activate BOOLEAN DEFAULT FALSE, -- Auto toggle on certain triggers
auto_deactivate BOOLEAN DEFAULT FALSE, -- Auto disable on poor performance
auto_adjust_based_on_performance BOOLEAN DEFAULT FALSE, -- Adaptive tuning

-- Notifications
notify_on_activation BOOLEAN DEFAULT FALSE, -- Notify when rule is activated
notify_on_significant_impact BOOLEAN DEFAULT FALSE, -- Notify on significant revenue or occupancy impact
notification_recipients UUID [], -- Users to notify

-- Approval Workflow
requires_approval BOOLEAN DEFAULT FALSE,
approval_status VARCHAR(50) DEFAULT 'approved' CHECK (
    approval_status IN (
        'draft',
        'pending',
        'approved',
        'rejected'
    )
), -- Current approval status
approved_by UUID, -- Approver identifier
approved_at TIMESTAMP WITH TIME ZONE, -- Approval timestamp
approval_notes TEXT, -- Notes related to approval

-- Override
can_be_overridden BOOLEAN DEFAULT TRUE, -- Allow manual override
override_requires_approval BOOLEAN DEFAULT FALSE, -- Overrides need approval
override_count INTEGER DEFAULT 0, -- Number of times overridden

-- Audit Trail
last_modified_reason TEXT, -- Reason for last modification
change_history JSONB, -- [{timestamp, user, field, old_value, new_value}]

-- Metadata
metadata JSONB,
tags VARCHAR(100) [],
notes TEXT, -- Additional info

-- Standard Timestamps
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
created_by UUID, -- Creator identifier
updated_by UUID, -- Modifier identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
    deleted_at TIMESTAMP WITH TIME ZONE, -- Deletion timestamp
    deleted_by UUID -- Deleting user
);

-- Comments
COMMENT ON TABLE pricing_rules IS 'Dynamic pricing rules engine for automated rate adjustments based on conditions';

COMMENT ON COLUMN pricing_rules.conditions IS 'JSON object defining conditions that must be met for rule to apply';

COMMENT ON COLUMN pricing_rules.conflict_resolution IS 'Strategy when multiple rules match: highest_priority, lowest_rate, highest_rate, etc';

COMMENT ON COLUMN pricing_rules.adjustment_type IS 'Type of rate adjustment: percentage_increase, percentage_decrease, set_to_amount, etc';

COMMENT ON COLUMN pricing_rules.can_combine_with_other_rules IS 'Whether this rule can be applied along with other rules';

\echo 'pricing_rules table created successfully!'
