-- =====================================================
-- 56_revenue_goals_indexes.sql
-- Revenue Goals Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating revenue_goals indexes...'

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
-- Simplified index without CURRENT_DATE (not immutable)
-- Applications can filter by period date range at query time using this index
CREATE INDEX idx_revenue_goals_active_period ON revenue_goals(property_id, period_start_date, period_end_date)
WHERE status = 'active' AND period_start_date IS NOT NULL AND period_end_date IS NOT NULL AND is_deleted = FALSE;

\echo 'Revenue Goals indexes created successfully!'
