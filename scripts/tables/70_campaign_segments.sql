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
CREATE INDEX idx_campaign_segments_tenant ON campaign_segments(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_property ON campaign_segments(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_code ON campaign_segments(segment_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_type ON campaign_segments(segment_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_active ON campaign_segments(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_owner ON campaign_segments(owner_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_refresh ON campaign_segments(auto_refresh, next_refresh_at) WHERE auto_refresh = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_criteria ON campaign_segments USING gin(criteria_definition) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_metadata ON campaign_segments USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_tags ON campaign_segments USING gin(tags) WHERE is_deleted = FALSE;

CREATE INDEX idx_campaign_segments_property_active ON campaign_segments(property_id, is_active, segment_type) WHERE is_deleted = FALSE;

COMMENT ON TABLE campaign_segments IS 'Defines customer segments for targeted marketing campaigns';
