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
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique recommendation identifier

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Target Date & Room
recommendation_date DATE NOT NULL, -- Arrival date recommendation applies to
room_type_id UUID NOT NULL, -- FK room_types.id
rate_plan_id UUID, -- Optional FK rates.id

-- Current vs Recommended
current_rate DECIMAL(10, 2) NOT NULL, -- Current published rate
recommended_rate DECIMAL(10, 2) NOT NULL, -- Suggested replacement rate
rate_difference DECIMAL(10, 2) NOT NULL, -- Absolute difference
rate_difference_percent DECIMAL(5, 2) NOT NULL, -- Percent difference

-- Recommendation Direction
recommendation_action VARCHAR(50) NOT NULL CHECK (
    recommendation_action IN (
        'increase',
        'decrease',
        'maintain',
        'significant_increase',
        'significant_decrease'
    )
),
urgency VARCHAR(20) CHECK (
    urgency IN (
        'low',
        'medium',
        'high',
        'critical'
    )
),

-- Confidence & Quality
confidence_score DECIMAL(5, 2) NOT NULL, -- 0-100 model confidence
confidence_level VARCHAR(20) CHECK (
    confidence_level IN (
        'very_low',
        'low',
        'moderate',
        'high',
        'very_high'
    )
),
recommendation_quality VARCHAR(20) CHECK (
    recommendation_quality IN (
        'poor',
        'fair',
        'good',
        'excellent'
    )
),

-- Supporting Data
current_occupancy_percent DECIMAL(5, 2), -- Snapshot occupancy %
forecasted_occupancy_percent DECIMAL(5, 2), -- Forecast occupancy %
current_demand_level VARCHAR(50), -- Demand label driving recommendation
booking_pace VARCHAR(50), -- Pace descriptor vs plan
days_until_arrival INTEGER, -- Lead time at evaluation

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
competitor_average_rate DECIMAL(10, 2), -- Peer average price
market_position VARCHAR(50) CHECK (
    market_position IN (
        'below_market',
        'at_market',
        'above_market'
    )
), -- Position vs market
competitor_rate_spread DECIMAL(10, 2), -- High/low spread in comp set

-- Model Information
model_version VARCHAR(50), -- Model iteration identifier
model_algorithm VARCHAR(100), -- Algorithm label
model_training_date DATE, -- Last training date for transparency
model_accuracy_score DECIMAL(5, 2), -- Historical accuracy score

-- Data Sources Used
data_sources_used VARCHAR(100) [], -- ['historical_bookings', 'competitor_rates', 'events', 'weather']
data_quality_score DECIMAL(5, 2), -- Data integrity rating
data_freshness_hours INTEGER, -- Age of data powering model

-- Expected Impact
expected_revenue_impact DECIMAL(12, 2), -- Expected revenue delta
expected_occupancy_impact DECIMAL(5, 2), -- Impact on occupancy percentage
expected_bookings_impact INTEGER, -- Booking volume change
expected_revpar_impact DECIMAL(10, 2), -- Impact on RevPAR

-- Risk Assessment
risk_level VARCHAR(20) CHECK (
    risk_level IN (
        'very_low',
        'low',
        'medium',
        'high',
        'very_high'
    )
), -- Risk bucket
risk_factors JSONB, -- Details about risk contributors
downside_risk DECIMAL(12, 2), -- Possible revenue downside
upside_potential DECIMAL(12, 2), -- Possible upside gain

-- Alternative Recommendations
alternative_rate_1 DECIMAL(10, 2), -- Secondary option
alternative_rate_1_confidence DECIMAL(5, 2), -- Confidence in alt option
alternative_rate_2 DECIMAL(10, 2), -- Tertiary option
alternative_rate_2_confidence DECIMAL(5, 2), -- Confidence in tertiary option

-- Status
status VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN (
        'pending',
        'reviewed',
        'accepted',
        'rejected',
        'partially_accepted',
        'expired',
        'superseded',
        'auto_applied'
    )
),

-- Review & Decision
reviewed_by UUID,
reviewed_at TIMESTAMP WITH TIME ZONE,
review_notes TEXT,
accepted BOOLEAN, -- Whether recommendation was accepted
accepted_by UUID, -- Decision maker identifier
accepted_at TIMESTAMP WITH TIME ZONE, -- Acceptance timestamp
acceptance_method VARCHAR(50) CHECK (
    acceptance_method IN (
        'manual',
        'auto',
        'bulk',
        'api'
    )
),
rejected BOOLEAN DEFAULT FALSE, -- Rejection flag
rejected_by UUID, -- Rejecting user
rejected_at TIMESTAMP WITH TIME ZONE, -- Rejection timestamp
rejection_reason VARCHAR(255), -- Reason for decline

-- Implementation
implemented BOOLEAN DEFAULT FALSE, -- Applied to system
implemented_rate DECIMAL(10, 2), -- Actual rate applied
implemented_at TIMESTAMP WITH TIME ZONE, -- Implementation timestamp
implemented_by UUID, -- Implementing user/system
implementation_notes TEXT, -- Additional notes

-- Actual Results (After Stay Date)
actual_rate_applied DECIMAL(10, 2), -- Rate guests paid
actual_occupancy_percent DECIMAL(5, 2), -- Realized occupancy %
actual_revenue DECIMAL(12, 2), -- Actual revenue generated
actual_bookings INTEGER, -- Actual number of bookings

-- Performance Validation
recommendation_accuracy DECIMAL(5, 2), -- How close was prediction
revenue_variance DECIMAL(12, 2), -- Difference in expected vs actual revenue
occupancy_variance DECIMAL(5, 2), -- Difference in expected vs actual occupancy
was_recommendation_effective BOOLEAN, -- Flag for effectiveness
effectiveness_score DECIMAL(5, 2), -- Scoring of effectiveness

-- Learning Feedback
feedback_provided BOOLEAN DEFAULT FALSE, -- Whether feedback was given
feedback_rating INTEGER CHECK (
    feedback_rating BETWEEN 1 AND 5
),
feedback_comments TEXT, -- Additional feedback details
feedback_by UUID, -- Feedback provider
feedback_at TIMESTAMP WITH TIME ZONE, -- Feedback timestamp

-- Expiry
valid_until TIMESTAMP WITH TIME ZONE, -- Expiration timestamp
is_expired BOOLEAN DEFAULT FALSE, -- Expiry flag
superseded_by UUID, -- FK to new recommendation if superseded

-- Automation
auto_apply_eligible BOOLEAN DEFAULT FALSE, -- Eligible for auto-application
auto_applied BOOLEAN DEFAULT FALSE, -- Whether auto-applied
auto_apply_threshold DECIMAL(5, 2), -- Minimum confidence for auto-apply

-- Metadata
metadata JSONB, -- Extension data
tags VARCHAR(100) [], -- Labeling for reporting
notes TEXT, -- Free form notes

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
COMMENT ON TABLE rate_recommendations IS 'AI-generated rate recommendations with confidence scoring and performance tracking';

COMMENT ON COLUMN rate_recommendations.confidence_score IS 'Model confidence in recommendation accuracy (0-100)';

COMMENT ON COLUMN rate_recommendations.contributing_factors IS 'JSON array of factors influencing the recommendation with weights';

COMMENT ON COLUMN rate_recommendations.effectiveness_score IS 'Post-implementation validation score of recommendation accuracy';

COMMENT ON COLUMN rate_recommendations.auto_apply_threshold IS 'Minimum confidence score required for automatic implementation';
