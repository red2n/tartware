-- =====================================================
-- Rate Recommendations Table
-- =====================================================
-- Purpose: AI-generated rate recommendations for revenue managers
-- Key Features:
--   - ML-driven pricing suggestions
--   - Confidence scoring
--   - Acceptance tracking
--   - Performance validation
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_recommendations (
    -- Primary Key
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Target Date & Room
    recommendation_date DATE NOT NULL,
    room_type_id UUID NOT NULL,
    rate_plan_id UUID,

    -- Current vs Recommended
    current_rate DECIMAL(10,2) NOT NULL,
    recommended_rate DECIMAL(10,2) NOT NULL,
    rate_difference DECIMAL(10,2) NOT NULL,
    rate_difference_percent DECIMAL(5,2) NOT NULL,

    -- Recommendation Direction
    recommendation_action VARCHAR(50) NOT NULL CHECK (recommendation_action IN (
        'increase', 'decrease', 'maintain', 'significant_increase', 'significant_decrease'
    )),
    urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high', 'critical')),

    -- Confidence & Quality
    confidence_score DECIMAL(5,2) NOT NULL, -- 0-100
    confidence_level VARCHAR(20) CHECK (confidence_level IN ('very_low', 'low', 'moderate', 'high', 'very_high')),
    recommendation_quality VARCHAR(20) CHECK (recommendation_quality IN ('poor', 'fair', 'good', 'excellent')),

    -- Supporting Data
    current_occupancy_percent DECIMAL(5,2),
    forecasted_occupancy_percent DECIMAL(5,2),
    current_demand_level VARCHAR(50),
    booking_pace VARCHAR(50),
    days_until_arrival INTEGER,

    -- Reasoning
    primary_reason VARCHAR(255) NOT NULL,
    contributing_factors JSONB, -- [{factor, weight, description}]
    /*
    Example:
    [
        {"factor": "High Demand", "weight": 0.35, "description": "Occupancy forecast at 92%"},
        {"factor": "Event Impact", "weight": 0.25, "description": "Major conference in city"},
        {"factor": "Competitor Rates", "weight": 0.20, "description": "Competitors $30 higher"},
        {"factor": "Booking Pace", "weight": 0.20, "description": "15 days ahead of forecast"}
    ]
    */

    -- Market Intelligence
    competitor_average_rate DECIMAL(10,2),
    market_position VARCHAR(50) CHECK (market_position IN ('below_market', 'at_market', 'above_market')),
    competitor_rate_spread DECIMAL(10,2),

    -- Model Information
    model_version VARCHAR(50),
    model_algorithm VARCHAR(100),
    model_training_date DATE,
    model_accuracy_score DECIMAL(5,2),

    -- Data Sources Used
    data_sources_used VARCHAR(100)[], -- ['historical_bookings', 'competitor_rates', 'events', 'weather']
    data_quality_score DECIMAL(5,2),
    data_freshness_hours INTEGER,

    -- Expected Impact
    expected_revenue_impact DECIMAL(12,2),
    expected_occupancy_impact DECIMAL(5,2),
    expected_bookings_impact INTEGER,
    expected_revpar_impact DECIMAL(10,2),

    -- Risk Assessment
    risk_level VARCHAR(20) CHECK (risk_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),
    risk_factors JSONB,
    downside_risk DECIMAL(12,2),
    upside_potential DECIMAL(12,2),

    -- Alternative Recommendations
    alternative_rate_1 DECIMAL(10,2),
    alternative_rate_1_confidence DECIMAL(5,2),
    alternative_rate_2 DECIMAL(10,2),
    alternative_rate_2_confidence DECIMAL(5,2),

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'reviewed', 'accepted', 'rejected', 'partially_accepted',
        'expired', 'superseded', 'auto_applied'
    )),

    -- Review & Decision
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    accepted BOOLEAN,
    accepted_by UUID,
    accepted_at TIMESTAMP WITH TIME ZONE,
    acceptance_method VARCHAR(50) CHECK (acceptance_method IN ('manual', 'auto', 'bulk', 'api')),

    rejected BOOLEAN DEFAULT FALSE,
    rejected_by UUID,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason VARCHAR(255),

    -- Implementation
    implemented BOOLEAN DEFAULT FALSE,
    implemented_rate DECIMAL(10,2),
    implemented_at TIMESTAMP WITH TIME ZONE,
    implemented_by UUID,
    implementation_notes TEXT,

    -- Actual Results (After Stay Date)
    actual_rate_applied DECIMAL(10,2),
    actual_occupancy_percent DECIMAL(5,2),
    actual_revenue DECIMAL(12,2),
    actual_bookings INTEGER,

    -- Performance Validation
    recommendation_accuracy DECIMAL(5,2), -- How close was prediction
    revenue_variance DECIMAL(12,2),
    occupancy_variance DECIMAL(5,2),
    was_recommendation_effective BOOLEAN,
    effectiveness_score DECIMAL(5,2),

    -- Learning Feedback
    feedback_provided BOOLEAN DEFAULT FALSE,
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comments TEXT,
    feedback_by UUID,
    feedback_at TIMESTAMP WITH TIME ZONE,

    -- Expiry
    valid_until TIMESTAMP WITH TIME ZONE,
    is_expired BOOLEAN DEFAULT FALSE,
    superseded_by UUID,

    -- Automation
    auto_apply_eligible BOOLEAN DEFAULT FALSE,
    auto_applied BOOLEAN DEFAULT FALSE,
    auto_apply_threshold DECIMAL(5,2), -- Minimum confidence for auto-apply

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

-- Indexes for rate_recommendations
CREATE INDEX idx_rate_recommendations_tenant ON rate_recommendations(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_property ON rate_recommendations(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_date ON rate_recommendations(recommendation_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_room_type ON rate_recommendations(room_type_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_rate_plan ON rate_recommendations(rate_plan_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_action ON rate_recommendations(recommendation_action) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_status ON rate_recommendations(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_pending ON rate_recommendations(status) WHERE status = 'pending' AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_urgency ON rate_recommendations(urgency) WHERE urgency IN ('high', 'critical') AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_confidence ON rate_recommendations(confidence_score DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_accepted ON rate_recommendations(accepted) WHERE accepted = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_implemented ON rate_recommendations(implemented) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_expired ON rate_recommendations(is_expired) WHERE is_expired = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_valid_until ON rate_recommendations(valid_until) WHERE is_expired = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_auto_apply ON rate_recommendations(auto_apply_eligible, auto_applied) WHERE auto_apply_eligible = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_model ON rate_recommendations(model_version, model_algorithm) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_effectiveness ON rate_recommendations(was_recommendation_effective, effectiveness_score) WHERE was_recommendation_effective IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_contributing_factors ON rate_recommendations USING gin(contributing_factors) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_metadata ON rate_recommendations USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_tags ON rate_recommendations USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_rate_recommendations_property_date ON rate_recommendations(property_id, recommendation_date, status) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_property_pending ON rate_recommendations(property_id, status, urgency DESC, confidence_score DESC) WHERE status = 'pending' AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_room_date ON rate_recommendations(room_type_id, recommendation_date, status) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_property_room_date ON rate_recommendations(property_id, room_type_id, recommendation_date) WHERE is_deleted = FALSE;

-- Comments
COMMENT ON TABLE rate_recommendations IS 'AI-generated rate recommendations with confidence scoring and performance tracking';
COMMENT ON COLUMN rate_recommendations.confidence_score IS 'Model confidence in recommendation accuracy (0-100)';
COMMENT ON COLUMN rate_recommendations.contributing_factors IS 'JSON array of factors influencing the recommendation with weights';
COMMENT ON COLUMN rate_recommendations.effectiveness_score IS 'Post-implementation validation score of recommendation accuracy';
COMMENT ON COLUMN rate_recommendations.auto_apply_threshold IS 'Minimum confidence score required for automatic implementation';
