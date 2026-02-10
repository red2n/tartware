-- =====================================================
-- Campaign Segments Table
-- =====================================================
-- Purpose: Define customer segments for targeted campaigns
-- Key Features:
--   - Dynamic segmentation
--   - Rule-based criteria
--   - Segment tracking
--   - Performance analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_segments (
    -- Primary Key
    segment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Segment Identification
    segment_code VARCHAR(100) UNIQUE NOT NULL,
    segment_name VARCHAR(255) NOT NULL,
    segment_description TEXT,

    -- Segment Type
    segment_type VARCHAR(100) CHECK (segment_type IN (
        'demographic', 'behavioral', 'psychographic', 'geographic',
        'transactional', 'loyalty', 'engagement', 'lifecycle',
        'predictive', 'custom'
    )),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_dynamic BOOLEAN DEFAULT TRUE,

    -- Criteria
    criteria_definition JSONB NOT NULL,
    sql_filter TEXT,

    -- Demographics
    age_range_min INTEGER,
    age_range_max INTEGER,
    gender VARCHAR(50)[],
    income_level VARCHAR(50)[],

    -- Geographic
    countries VARCHAR(3)[],
    states_provinces VARCHAR(100)[],
    cities VARCHAR(100)[],
    zip_codes VARCHAR(20)[],
    distance_from_property_km INTEGER,

    -- Behavioral
    booking_frequency VARCHAR(50) CHECK (booking_frequency IN (
        'first_time', 'occasional', 'regular', 'frequent', 'vip'
    )),
    last_booking_days_ago_min INTEGER,
    last_booking_days_ago_max INTEGER,

    average_booking_value_min DECIMAL(10,2),
    average_booking_value_max DECIMAL(10,2),

    total_lifetime_value_min DECIMAL(12,2),
    total_lifetime_value_max DECIMAL(12,2),

    -- Engagement
    engagement_level VARCHAR(50) CHECK (engagement_level IN (
        'not_engaged', 'low', 'medium', 'high', 'very_high'
    )),

    email_engagement VARCHAR(50),
    website_visits_min INTEGER,
    social_media_follower BOOLEAN,

    -- Loyalty
    loyalty_tier VARCHAR(100)[],
    loyalty_points_min INTEGER,
    loyalty_points_max INTEGER,

    -- Guest Status
    guest_status VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR[],

    -- Preferences
    preferred_room_types VARCHAR(100)[],
    preferred_amenities VARCHAR(100)[],
    travel_purpose VARCHAR(100)[],

    -- Lifecycle Stage
    lifecycle_stage VARCHAR(100) CHECK (lifecycle_stage IN (
        'prospect', 'new_customer', 'active', 'at_risk',
        'dormant', 'lost', 'won_back'
    )),

    -- Predictive
    churn_risk_level VARCHAR(50),
    propensity_to_book_score_min INTEGER,
    propensity_to_book_score_max INTEGER,

    -- Exclusions
    exclude_segment_ids UUID[],
    exclude_unsubscribed BOOLEAN DEFAULT TRUE,
    exclude_bounced_emails BOOLEAN DEFAULT TRUE,

    -- Size & Statistics
    member_count INTEGER DEFAULT 0,
    last_calculated_count INTEGER,
    last_calculation_date TIMESTAMP WITH TIME ZONE,

    auto_refresh BOOLEAN DEFAULT TRUE,
    refresh_frequency_hours INTEGER DEFAULT 24,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    next_refresh_at TIMESTAMP WITH TIME ZONE,

    -- Performance
    campaigns_used_in INTEGER DEFAULT 0,
    total_emails_sent INTEGER DEFAULT 0,
    average_open_rate DECIMAL(5,2),
    average_click_rate DECIMAL(5,2),
    average_conversion_rate DECIMAL(5,2),

    total_revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    total_bookings INTEGER DEFAULT 0,

    -- Member Management
    manual_inclusions UUID[],
    manual_exclusions UUID[],

    -- Testing
    is_test_segment BOOLEAN DEFAULT FALSE,
    test_sample_size INTEGER,

    -- Owner
    owner_id UUID,
    shared_with_users UUID[],
    is_public BOOLEAN DEFAULT FALSE,

    -- Metadata
    metadata JSONB,
    notes TEXT,
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

-- Indexes


COMMENT ON TABLE campaign_segments IS 'Defines customer segments for targeted marketing campaigns';
COMMENT ON COLUMN campaign_segments.segment_id IS 'Unique identifier for the campaign segment';
COMMENT ON COLUMN campaign_segments.tenant_id IS 'Tenant owning this segment';
COMMENT ON COLUMN campaign_segments.property_id IS 'Property this segment is scoped to, NULL for tenant-wide';
COMMENT ON COLUMN campaign_segments.segment_code IS 'Unique short code used to reference the segment';
COMMENT ON COLUMN campaign_segments.segment_name IS 'Human-readable name of the segment';
COMMENT ON COLUMN campaign_segments.segment_type IS 'Classification of segment (demographic, behavioral, predictive, etc.)';
COMMENT ON COLUMN campaign_segments.is_active IS 'Whether the segment is currently active for campaign targeting';
COMMENT ON COLUMN campaign_segments.is_dynamic IS 'Whether membership is recalculated automatically based on criteria';
COMMENT ON COLUMN campaign_segments.criteria_definition IS 'JSON rules defining segment membership criteria';
COMMENT ON COLUMN campaign_segments.sql_filter IS 'Raw SQL filter expression for dynamic membership evaluation';
COMMENT ON COLUMN campaign_segments.booking_frequency IS 'Guest booking frequency band (first_time, occasional, regular, frequent, vip)';
COMMENT ON COLUMN campaign_segments.average_booking_value_min IS 'Minimum average booking value threshold for segment inclusion';
COMMENT ON COLUMN campaign_segments.total_lifetime_value_min IS 'Minimum guest lifetime value threshold for segment inclusion';
COMMENT ON COLUMN campaign_segments.engagement_level IS 'Guest engagement intensity level (low through very_high)';
COMMENT ON COLUMN campaign_segments.loyalty_tier IS 'Loyalty program tiers eligible for this segment';
COMMENT ON COLUMN campaign_segments.lifecycle_stage IS 'Customer lifecycle stage (prospect, active, at_risk, dormant, etc.)';
COMMENT ON COLUMN campaign_segments.churn_risk_level IS 'Predicted churn risk level for predictive segmentation';
COMMENT ON COLUMN campaign_segments.member_count IS 'Current number of guests in this segment';
COMMENT ON COLUMN campaign_segments.auto_refresh IS 'Whether segment membership is refreshed automatically on a schedule';
COMMENT ON COLUMN campaign_segments.refresh_frequency_hours IS 'Hours between automatic membership recalculations';
COMMENT ON COLUMN campaign_segments.campaigns_used_in IS 'Number of campaigns that have used this segment for targeting';
COMMENT ON COLUMN campaign_segments.average_open_rate IS 'Average email open rate across campaigns using this segment';
COMMENT ON COLUMN campaign_segments.average_conversion_rate IS 'Average conversion rate across campaigns using this segment';
COMMENT ON COLUMN campaign_segments.total_revenue_generated IS 'Total revenue attributed to campaigns targeting this segment';
COMMENT ON COLUMN campaign_segments.exclude_unsubscribed IS 'Whether to automatically exclude guests who have unsubscribed';
COMMENT ON COLUMN campaign_segments.is_test_segment IS 'Whether this segment is used for testing purposes only';

\echo 'campaign_segments table created successfully!'
