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
    goal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Goal Period
    goal_period VARCHAR(50) NOT NULL CHECK (goal_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom')),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,

    -- Goal Type
    goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN (
        'total_revenue', 'room_revenue', 'fb_revenue', 'other_revenue',
        'occupancy', 'adr', 'revpar', 'rooms_sold', 'arr'
    )),
    goal_category VARCHAR(100) CHECK (goal_category IN ('budget', 'forecast', 'stretch', 'minimum', 'target')),

    -- Goal Values
    goal_amount DECIMAL(12,2),
    goal_percent DECIMAL(5,2),
    goal_count INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Baseline & Comparison
    baseline_amount DECIMAL(12,2), -- Previous year same period
    baseline_source VARCHAR(100),
    growth_target_percent DECIMAL(5,2),

    -- Breakdown
    room_revenue_goal DECIMAL(12,2),
    fb_revenue_goal DECIMAL(12,2),
    other_revenue_goal DECIMAL(12,2),
    occupancy_goal_percent DECIMAL(5,2),
    adr_goal DECIMAL(10,2),
    revpar_goal DECIMAL(10,2),

    -- Segmentation Goals
    segment_goals JSONB, -- {leisure: {goal: 500000, percent: 60}, corporate: {...}}
    channel_goals JSONB, -- {direct: {goal: 400000}, ota: {goal: 600000}}
    room_type_goals JSONB,

    -- Actual Performance
    actual_amount DECIMAL(12,2) DEFAULT 0.00,
    actual_percent DECIMAL(5,2),
    actual_count INTEGER DEFAULT 0,

    -- Variance Analysis
    variance_amount DECIMAL(12,2),
    variance_percent DECIMAL(5,2),
    variance_status VARCHAR(50) CHECK (variance_status IN ('ahead', 'on_track', 'behind', 'significantly_behind', 'exceeded')),

    -- Progress Tracking
    progress_percent DECIMAL(5,2) DEFAULT 0.00,
    days_elapsed INTEGER,
    days_remaining INTEGER,
    expected_progress_percent DECIMAL(5,2),
    pace VARCHAR(50) CHECK (pace IN ('ahead_of_pace', 'on_pace', 'behind_pace', 'significantly_behind_pace')),

    -- Achievement
    is_achieved BOOLEAN DEFAULT FALSE,
    achievement_date DATE,
    achievement_percent DECIMAL(5,2),
    over_achievement_amount DECIMAL(12,2),

    -- Forecast vs Goal
    forecasted_amount DECIMAL(12,2),
    forecast_variance DECIMAL(12,2),
    forecast_confidence DECIMAL(5,2),
    likely_to_achieve BOOLEAN,

    -- Daily Tracking
    daily_run_rate_required DECIMAL(12,2),
    daily_run_rate_actual DECIMAL(12,2),
    cumulative_actual DECIMAL(12,2) DEFAULT 0.00,
    cumulative_goal_to_date DECIMAL(12,2),

    -- Milestones
    milestones JSONB, -- [{date, target_amount, achieved, achieved_date}]
    next_milestone_date DATE,
    next_milestone_target DECIMAL(12,2),

    -- Alerts & Thresholds
    alert_if_behind_by_percent DECIMAL(5,2) DEFAULT 10.00,
    alert_threshold_reached BOOLEAN DEFAULT FALSE,
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP WITH TIME ZONE,
    alert_recipients UUID[],

    -- Action Plans
    action_plan_required BOOLEAN DEFAULT FALSE,
    action_plan TEXT,
    action_plan_owner UUID,
    action_plan_due_date DATE,
    corrective_actions JSONB,

    -- External Factors
    external_factors_impact JSONB, -- [{factor, impact_amount, description}]
    market_conditions VARCHAR(100),
    events_impact JSONB,

    -- Team Performance
    responsible_user_id UUID,
    responsible_team VARCHAR(100),
    department VARCHAR(100),

    -- Incentives
    has_incentive_attached BOOLEAN DEFAULT FALSE,
    incentive_structure JSONB, -- {90%: bonus_tier_1, 100%: bonus_tier_2, 110%: bonus_tier_3}
    incentive_amount DECIMAL(10,2),
    incentive_paid BOOLEAN DEFAULT FALSE,

    -- Historical Comparison
    same_period_last_year_actual DECIMAL(12,2),
    same_period_last_year_goal DECIMAL(12,2),
    yoy_growth_actual_percent DECIMAL(5,2),
    yoy_growth_goal_percent DECIMAL(5,2),

    -- Approval & Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'pending_approval', 'active', 'completed', 'cancelled', 'revised')),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Revision History
    is_revised BOOLEAN DEFAULT FALSE,
    original_goal_id UUID,
    revision_number INTEGER DEFAULT 1,
    revision_reason TEXT,
    revised_by UUID,
    revised_at TIMESTAMP WITH TIME ZONE,

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

-- Indexes for revenue_goals
CREATE INDEX idx_revenue_goals_tenant ON revenue_goals(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_property ON revenue_goals(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_period ON revenue_goals(goal_period) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_type ON revenue_goals(goal_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_category ON revenue_goals(goal_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_date_range ON revenue_goals(period_start_date, period_end_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_fiscal ON revenue_goals(fiscal_year, fiscal_quarter) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_status ON revenue_goals(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_active ON revenue_goals(status) WHERE status = 'active' AND is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_variance ON revenue_goals(variance_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_pace ON revenue_goals(pace) WHERE pace IN ('behind_pace', 'significantly_behind_pace') AND is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_achieved ON revenue_goals(is_achieved, achievement_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_alert ON revenue_goals(alert_threshold_reached, alert_sent) WHERE alert_threshold_reached = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_action_plan ON revenue_goals(action_plan_required, action_plan_owner) WHERE action_plan_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_responsible ON revenue_goals(responsible_user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_incentive ON revenue_goals(has_incentive_attached, incentive_paid) WHERE has_incentive_attached = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_segment_goals ON revenue_goals USING gin(segment_goals) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_metadata ON revenue_goals USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_tags ON revenue_goals USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_revenue_goals_property_period ON revenue_goals(property_id, goal_period, period_start_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_property_active ON revenue_goals(property_id, status, period_end_date DESC) WHERE status = 'active' AND is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_property_type_period ON revenue_goals(property_id, goal_type, period_start_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_goals_current_period ON revenue_goals(property_id, period_start_date, period_end_date) WHERE status = 'active' AND CURRENT_DATE BETWEEN period_start_date AND period_end_date AND is_deleted = FALSE;

-- Comments
COMMENT ON TABLE revenue_goals IS 'Tracks revenue targets, budgets, and performance against goals with variance analysis';
COMMENT ON COLUMN revenue_goals.goal_period IS 'Time period for goal: daily, weekly, monthly, quarterly, annual, custom';
COMMENT ON COLUMN revenue_goals.variance_status IS 'Performance status: ahead, on_track, behind, significantly_behind, exceeded';
COMMENT ON COLUMN revenue_goals.pace IS 'Progress pace compared to expected timeline';
COMMENT ON COLUMN revenue_goals.incentive_structure IS 'JSON defining incentive tiers based on achievement percentage';
COMMENT ON COLUMN revenue_goals.segment_goals IS 'Revenue targets broken down by market segment';
