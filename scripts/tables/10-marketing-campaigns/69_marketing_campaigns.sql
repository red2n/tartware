-- =====================================================
-- Marketing Campaigns Table
-- =====================================================
-- Purpose: Manage marketing campaigns and promotions
-- Key Features:
--   - Multi-channel campaign management
--   - Performance tracking
--   - Budget management
--   - ROI analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    -- Primary Key
    campaign_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Campaign Identification
    campaign_code VARCHAR(100) UNIQUE NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_description TEXT,

    -- Campaign Type
    campaign_type VARCHAR(100) CHECK (campaign_type IN (
        'email', 'sms', 'social_media', 'display_ads', 'search_ads',
        'direct_mail', 'event', 'referral', 'loyalty', 'seasonal',
        'promotional', 'awareness', 'retargeting', 'multi_channel', 'other'
    )),
    campaign_category VARCHAR(100),

    -- Status
    campaign_status VARCHAR(50) DEFAULT 'draft' CHECK (campaign_status IN (
        'draft', 'scheduled', 'active', 'paused',
        'completed', 'cancelled', 'archived'
    )),

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    launch_date DATE,

    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(100),

    -- Target Audience
    target_audience_type VARCHAR(100) CHECK (target_audience_type IN (
        'all_guests', 'past_guests', 'prospects', 'loyal_customers',
        'high_value', 'dormant', 'at_risk', 'custom_segment', 'lookalike'
    )),
    target_segment_ids UUID[],

    target_audience_size INTEGER,
    target_locations VARCHAR(100)[],
    target_age_range VARCHAR(50),
    target_demographics JSONB,

    -- Channels
    channels VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[],
    primary_channel VARCHAR(100),

    -- Budget
    budget_amount DECIMAL(12,2),
    budget_currency VARCHAR(3) DEFAULT 'USD',
    actual_spend DECIMAL(12,2) DEFAULT 0.00,
    budget_utilization_percent DECIMAL(5,2),

    cost_per_impression DECIMAL(10,4),
    cost_per_click DECIMAL(10,4),
    cost_per_acquisition DECIMAL(10,2),

    -- Goals & KPIs
    primary_goal VARCHAR(100) CHECK (primary_goal IN (
        'awareness', 'engagement', 'lead_generation',
        'conversion', 'retention', 'revenue', 'bookings'
    )),

    target_impressions INTEGER,
    target_clicks INTEGER,
    target_conversions INTEGER,
    target_revenue DECIMAL(12,2),
    target_bookings INTEGER,
    target_roi_percent DECIMAL(5,2),

    -- Performance Metrics
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0.00,

    click_through_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    bounce_rate DECIMAL(5,2),
    engagement_rate DECIMAL(5,2),

    -- ROI
    roi_percent DECIMAL(5,2),
    roas DECIMAL(10,2), -- Return on Ad Spend

    -- Email Metrics (if applicable)
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,

    open_rate DECIMAL(5,2),
    click_rate DECIMAL(5,2),
    unsubscribe_rate DECIMAL(5,2),

    -- Social Media Metrics
    social_shares INTEGER DEFAULT 0,
    social_likes INTEGER DEFAULT 0,
    social_comments INTEGER DEFAULT 0,
    social_reach INTEGER DEFAULT 0,
    social_engagement_rate DECIMAL(5,2),

    -- Landing Page
    landing_page_url TEXT,
    landing_page_visits INTEGER DEFAULT 0,
    landing_page_conversion_rate DECIMAL(5,2),

    -- Tracking
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    tracking_code VARCHAR(100),

    -- Offers/Promotions
    has_offer BOOLEAN DEFAULT FALSE,
    offer_type VARCHAR(100),
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    promo_code VARCHAR(100),

    -- Content
    message_template TEXT,
    subject_line VARCHAR(255),
    call_to_action VARCHAR(255),

    creative_assets_urls TEXT[],

    -- A/B Testing
    is_ab_test BOOLEAN DEFAULT FALSE,
    ab_test_variants JSONB,
    winning_variant VARCHAR(50),

    -- Attribution
    attribution_model VARCHAR(100) CHECK (attribution_model IN (
        'first_touch', 'last_touch', 'linear', 'time_decay',
        'position_based', 'custom'
    )),

    -- Lead Generation
    leads_generated INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    lead_quality_score DECIMAL(5,2),

    -- Campaign Team
    campaign_manager_id UUID,
    created_by_user_id UUID,
    assigned_to_ids UUID[],

    -- Approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Review
    post_campaign_review_completed BOOLEAN DEFAULT FALSE,
    review_notes TEXT,
    lessons_learned TEXT,

    -- Integration
    integrated_with VARCHAR(100)[],
    external_campaign_id VARCHAR(255),

    -- Alerts
    alert_on_budget_threshold BOOLEAN DEFAULT TRUE,
    budget_alert_threshold_percent DECIMAL(5,2) DEFAULT 90.00,
    alert_recipients VARCHAR(255)[],

    -- Metadata
    metadata JSONB,
    notes TEXT,
    internal_notes TEXT,
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

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE marketing_campaigns IS 'Manages multi-channel marketing campaigns with performance tracking, budget management, and ROI analysis';
COMMENT ON COLUMN marketing_campaigns.campaign_id IS 'Unique campaign identifier (UUID)';
COMMENT ON COLUMN marketing_campaigns.tenant_id IS 'Reference to tenant (multi-tenancy)';
COMMENT ON COLUMN marketing_campaigns.property_id IS 'Reference to property (NULL for tenant-wide campaigns)';
COMMENT ON COLUMN marketing_campaigns.campaign_code IS 'Unique campaign code for tracking';
COMMENT ON COLUMN marketing_campaigns.campaign_name IS 'Name of the marketing campaign';
COMMENT ON COLUMN marketing_campaigns.campaign_type IS 'Type of campaign (email, sms, social_media, display_ads, etc.)';
COMMENT ON COLUMN marketing_campaigns.campaign_status IS 'Current status (draft, scheduled, active, paused, completed, cancelled)';
COMMENT ON COLUMN marketing_campaigns.start_date IS 'Campaign start date';
COMMENT ON COLUMN marketing_campaigns.end_date IS 'Campaign end date';
COMMENT ON COLUMN marketing_campaigns.budget_amount IS 'Total budget allocated for campaign';
COMMENT ON COLUMN marketing_campaigns.actual_spend IS 'Actual amount spent on campaign';
COMMENT ON COLUMN marketing_campaigns.target_audience_type IS 'Type of target audience';
COMMENT ON COLUMN marketing_campaigns.total_impressions IS 'Number of times campaign was displayed';
COMMENT ON COLUMN marketing_campaigns.total_clicks IS 'Number of clicks on campaign';
COMMENT ON COLUMN marketing_campaigns.total_conversions IS 'Number of conversions from campaign';
COMMENT ON COLUMN marketing_campaigns.total_revenue IS 'Revenue attributed to this campaign';
COMMENT ON COLUMN marketing_campaigns.roi_percent IS 'Return on Investment percentage';

\echo 'Marketing Campaigns table created successfully!'
