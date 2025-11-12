-- =====================================================
-- Revenue Goals Table
-- =====================================================
-- Purpose: Track revenue targets, budgets, and performance against goals
-- Key Features:
--   - Multi-level goal setting (daily/monthly/annual)
--   - Budget vs actual tracking
--   - Goal achievement monitoring
--   - Performance alerts
-- =====================================================

CREATE TABLE IF NOT EXISTS revenue_goals (
    -- Primary Key
    goal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique goal identifier

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Goal Period
goal_period VARCHAR(50) NOT NULL CHECK (
    goal_period IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'annual',
        'custom'
    )
),
period_start_date DATE NOT NULL, -- Goal start date
period_end_date DATE NOT NULL, -- Goal end date
fiscal_year INTEGER, -- Fiscal year reference
fiscal_quarter INTEGER, -- Fiscal quarter reference

-- Goal Type
goal_type VARCHAR(50) NOT NULL CHECK (
    goal_type IN (
        'total_revenue',
        'room_revenue',
        'fb_revenue',
        'other_revenue',
        'occupancy',
        'adr',
        'revpar',
        'rooms_sold',
        'arr'
    )
),  -- e.g., total_revenue, occupancy, adr, revpar
goal_category VARCHAR(100) CHECK (
    goal_category IN (
        'budget',
        'forecast',
        'stretch',
        'minimum',
        'target'
    )
),  -- e.g., budget, forecast, stretch, minimum, target

-- Goal Values
goal_amount DECIMAL(12, 2), -- Monetary target
goal_percent DECIMAL(5, 2), -- Percentage target (e.g., occupancy)
goal_count INTEGER, -- Count-based targets (rooms sold etc.)
currency VARCHAR(3) DEFAULT 'USD', -- Currency for monetary goals

-- Baseline & Comparison
baseline_amount DECIMAL(12, 2), -- Previous year same period
baseline_source VARCHAR(100), -- e.g., 'last_year', 'budget', 'forecast'
baseline_currency VARCHAR(3) DEFAULT 'USD', -- Currency for baseline amounts
baseline_date DATE, -- Date for baseline reference
growth_target_amount DECIMAL(12, 2), -- Growth target in monetary terms
growth_target_percent DECIMAL(5, 2), -- Growth target in percentage terms

-- Breakdown
room_revenue_goal DECIMAL(12, 2), -- Specific room revenue target
fb_revenue_goal DECIMAL(12, 2), -- Food & Beverage revenue target
other_revenue_goal DECIMAL(12, 2), -- Other revenue streams target
rooms_sold_goal INTEGER, -- Target number of rooms sold
occupancy_goal_percent DECIMAL(5, 2), -- Occupancy percentage goal
adr_goal DECIMAL(10, 2), -- Average Daily Rate goal
revpar_goal DECIMAL(10, 2), -- Revenue Per Available Room goal

-- Segmentation Goals
segment_goals JSONB, -- {leisure: {goal: 500000, percent: 60}, corporate: {...}}
channel_goals JSONB, -- {direct: {goal: 400000}, ota: {goal: 600000}}
room_type_goals JSONB, -- {standard: {goal: 300000}, deluxe: {goal: 700000}}

-- Actual Performance
actual_amount DECIMAL(12, 2) DEFAULT 0.00, -- Actual revenue/count achieved
actual_percent DECIMAL(5, 2), -- Actual percentage metrics
actual_count INTEGER DEFAULT 0, -- Actual units achieved

-- Variance Analysis
variance_amount DECIMAL(12, 2), -- Absolute variance vs goal
variance_percent DECIMAL(5, 2), -- Percentage variance vs goal
variance_status VARCHAR(50) CHECK (
    variance_status IN (
        'ahead',
        'on_track',
        'behind',
        'significantly_behind',
        'exceeded'
    )
), -- Status of variance

-- Progress Tracking
progress_percent DECIMAL(5, 2) DEFAULT 0.00, -- Percent of goal achieved
days_elapsed INTEGER, -- Days passed in goal period
days_remaining INTEGER, -- Days left in goal period
expected_progress_percent DECIMAL(5, 2), -- Expected progress percent
pace VARCHAR(50) CHECK (
    pace IN (
        'ahead_of_pace',
        'on_pace',
        'behind_pace',
        'significantly_behind_pace'
    )
), -- Progress pace

-- Achievement
is_achieved BOOLEAN DEFAULT FALSE, -- Goal attainment flag
achievement_date DATE, -- Date goal was reached
achievement_percent DECIMAL(5, 2), -- Percent achieved
over_achievement_amount DECIMAL(12, 2), -- Surplus beyond goal

-- Forecast vs Goal
forecasted_amount DECIMAL(12, 2), -- Forecasted end-period value
forecast_variance DECIMAL(12, 2), -- Forecast vs goal variance
forecast_confidence DECIMAL(5, 2), -- Forecast confidence
likely_to_achieve BOOLEAN, -- Probability flag

-- Daily Tracking
daily_run_rate_required DECIMAL(12, 2), -- Required daily rate to meet goal
daily_run_rate_actual DECIMAL(12, 2), -- Actual daily rate achieved
daily_tracking JSONB, -- [{date, goal_amount, actual_amount, variance_amount}]
cumulative_actual DECIMAL(12, 2) DEFAULT 0.00, -- Cumulative actual to date
cumulative_goal_to_date DECIMAL(12, 2), -- Cumulative goal to date

-- Milestones
milestones JSONB, -- [{date, target_amount, achieved, achieved_date}]
next_milestone_date DATE, -- Date of next milestone
next_milestone_target DECIMAL(12, 2), -- Target amount for next milestone

-- Alerts & Thresholds
alert_if_behind_by_percent DECIMAL(5, 2) DEFAULT 10.00, -- Alert threshold %
alert_if_behind_by_amount DECIMAL(12, 2) DEFAULT 1000.00, -- Alert threshold amount
alert_threshold_reached BOOLEAN DEFAULT FALSE, -- Alert flag
alert_sent BOOLEAN DEFAULT FALSE, -- Whether alert was sent
alert_sent_at TIMESTAMP WITH TIME ZONE, -- Alert sent timestamp
alert_recipients UUID [], -- Users to notify

-- Action Plans
action_plan_required BOOLEAN DEFAULT FALSE, -- Flag for action plan
action_plan TEXT, -- Description of action plan
action_plan_owner UUID, -- Owner of action plan
action_plan_due_date DATE, -- Due date for action plan
corrective_actions JSONB, -- [{action, owner, due_date, status}]

-- External Factors
external_factors_impact JSONB, -- [{factor, impact_amount, description}]
market_conditions VARCHAR(100), -- e.g., 'strong', 'weak', 'stable'
events_impact JSONB, -- [{event, date, expected_impact}]

-- Team Performance
responsible_user_id UUID, -- User accountable for goal
responsible_team VARCHAR(100), -- Team responsible for goal
department VARCHAR(100), -- Department responsible for goal

-- Incentives
has_incentive_attached BOOLEAN DEFAULT FALSE, -- Flag for incentive
incentive_structure JSONB, -- {90%: bonus_tier_1, 100%: bonus_tier_2, 110%: bonus_tier_3}
incentive_amount DECIMAL(10, 2), -- Calculated incentive amount
incentive_paid BOOLEAN DEFAULT FALSE, -- Whether incentive was paid
incentive_paid_at TIMESTAMP WITH TIME ZONE, -- Incentive payment timestamp

-- Historical Comparison
same_period_last_year_actual DECIMAL(12, 2), -- Actuals from same period last year
same_period_last_year_goal DECIMAL(12, 2), -- Goals from same period last year
yoy_growth_actual_percent DECIMAL(5, 2), -- Year-over-year actual growth %
yoy_growth_goal_percent DECIMAL(5, 2), -- Year-over-year goal growth %

-- Approval & Status
status VARCHAR(50) DEFAULT 'active' CHECK (
    status IN (
        'draft',
        'pending_approval',
        'active',
        'completed',
        'cancelled',
        'revised'
    )
), -- Current status of the goal
submitted_by UUID,
submitted_at TIMESTAMP WITH TIME ZONE,
approved_by UUID, -- Approver identifier
approved_at TIMESTAMP WITH TIME ZONE, -- Approval timestamp
approval_notes TEXT, -- Notes from approver
rejected BOOLEAN DEFAULT FALSE, -- Rejection flag
rejected_by UUID, -- Rejecting user
rejected_at TIMESTAMP WITH TIME ZONE, -- Rejection timestamp
rejection_reason VARCHAR(255), -- Reason for rejection

-- Revision History
is_revised BOOLEAN DEFAULT FALSE, -- Flag for revisions
original_goal_id UUID, -- Reference to original goal
revision_number INTEGER DEFAULT 1, -- Revision iteration
revision_reason TEXT, -- Reason for revision
revised_by UUID, -- User who made the revision
revised_at TIMESTAMP WITH TIME ZONE, -- Revision timestamp

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
    deleted_by UUID -- Actor performing deletion
);

-- Comments
COMMENT ON TABLE revenue_goals IS 'Tracks revenue targets, budgets, and performance against goals with variance analysis';

COMMENT ON COLUMN revenue_goals.goal_period IS 'Time period for goal: daily, weekly, monthly, quarterly, annual, custom';

COMMENT ON COLUMN revenue_goals.variance_status IS 'Performance status: ahead, on_track, behind, significantly_behind, exceeded';

COMMENT ON COLUMN revenue_goals.pace IS 'Progress pace compared to expected timeline';

COMMENT ON COLUMN revenue_goals.incentive_structure IS 'JSON defining incentive tiers based on achievement percentage';

COMMENT ON COLUMN revenue_goals.segment_goals IS 'Revenue targets broken down by market segment';
