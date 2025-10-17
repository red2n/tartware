-- =====================================================
-- Referral Tracking Table
-- =====================================================
-- Purpose: Track guest referrals and rewards
-- Key Features:
--   - Referral program management
--   - Reward tracking
--   - Multi-tier referrals
--   - Performance analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS referral_tracking (
    -- Primary Key
    referral_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Referral Code
    referral_code VARCHAR(100) UNIQUE NOT NULL,
    referral_link TEXT,

    -- Referrer (Person Making Referral)
    referrer_type VARCHAR(50) CHECK (referrer_type IN (
        'guest', 'staff', 'affiliate', 'influencer', 'partner', 'other'
    )),
    referrer_id UUID NOT NULL,
    referrer_name VARCHAR(255),
    referrer_email VARCHAR(255),
    referrer_phone VARCHAR(50),

    -- Referee (Person Being Referred)
    referee_id UUID,
    referee_name VARCHAR(255),
    referee_email VARCHAR(255),
    referee_phone VARCHAR(50),

    -- Referral Status
    referral_status VARCHAR(50) DEFAULT 'pending' CHECK (referral_status IN (
        'pending', 'clicked', 'registered', 'qualified',
        'converted', 'rewarded', 'expired', 'cancelled'
    )),

    -- Dates
    referred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    link_clicked_at TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE,
    qualified_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE,

    expires_at TIMESTAMP WITH TIME ZONE,

    -- Conversion Details
    converted BOOLEAN DEFAULT FALSE,
    conversion_type VARCHAR(100) CHECK (conversion_type IN (
        'booking', 'signup', 'purchase', 'trial', 'subscription', 'other'
    )),

    reservation_id UUID,
    booking_amount DECIMAL(12,2),
    booking_date DATE,
    check_in_date DATE,

    -- Rewards - Referrer
    referrer_reward_type VARCHAR(100) CHECK (referrer_reward_type IN (
        'discount_percent', 'discount_fixed', 'credit', 'points',
        'free_night', 'upgrade', 'cash', 'gift_card', 'other'
    )),

    referrer_reward_amount DECIMAL(10,2),
    referrer_reward_percent DECIMAL(5,2),
    referrer_reward_points INTEGER,
    referrer_reward_currency VARCHAR(3) DEFAULT 'USD',

    referrer_reward_issued BOOLEAN DEFAULT FALSE,
    referrer_reward_issued_at TIMESTAMP WITH TIME ZONE,
    referrer_reward_redeemed BOOLEAN DEFAULT FALSE,

    -- Rewards - Referee
    referee_reward_type VARCHAR(100) CHECK (referee_reward_type IN (
        'discount_percent', 'discount_fixed', 'credit', 'points',
        'free_night', 'upgrade', 'welcome_bonus', 'other'
    )),

    referee_reward_amount DECIMAL(10,2),
    referee_reward_percent DECIMAL(5,2),
    referee_reward_points INTEGER,
    referee_reward_currency VARCHAR(3) DEFAULT 'USD',

    referee_reward_issued BOOLEAN DEFAULT FALSE,
    referee_reward_issued_at TIMESTAMP WITH TIME ZONE,
    referee_reward_redeemed BOOLEAN DEFAULT FALSE,

    -- Multi-Tier Tracking
    tier_level INTEGER DEFAULT 1,
    parent_referral_id UUID,
    child_referral_ids UUID[],

    -- Campaign Association
    campaign_id UUID,
    referral_program_id UUID,

    -- Source Tracking
    source_channel VARCHAR(100),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Qualification Criteria
    qualification_criteria JSONB,
    qualified BOOLEAN DEFAULT FALSE,
    qualification_notes TEXT,

    minimum_booking_amount DECIMAL(10,2),
    minimum_stay_nights INTEGER,

    -- Performance Metrics
    link_clicks INTEGER DEFAULT 0,
    successful_conversions INTEGER DEFAULT 0,
    total_referral_value DECIMAL(12,2) DEFAULT 0.00,

    -- Revenue Impact
    revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    lifetime_value_generated DECIMAL(12,2) DEFAULT 0.00,

    -- Communication
    invitation_sent BOOLEAN DEFAULT FALSE,
    invitation_sent_at TIMESTAMP WITH TIME ZONE,
    invitation_method VARCHAR(50),

    reminder_count INTEGER DEFAULT 0,
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE,

    -- Fraud Detection
    flagged_suspicious BOOLEAN DEFAULT FALSE,
    fraud_check_passed BOOLEAN,
    fraud_notes TEXT,

    same_ip_address BOOLEAN,
    same_device BOOLEAN,

    -- Attribution
    attribution_verified BOOLEAN DEFAULT FALSE,
    attribution_notes TEXT,

    -- Approval (for high-value rewards)
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Analytics
    device_type VARCHAR(50),
    browser VARCHAR(100),
    ip_address VARCHAR(45),
    geo_location VARCHAR(255),

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

-- Indexes
CREATE INDEX idx_referral_tracking_tenant ON referral_tracking(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_property ON referral_tracking(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_code ON referral_tracking(referral_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_referrer ON referral_tracking(referrer_type, referrer_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_referee ON referral_tracking(referee_id) WHERE referee_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_status ON referral_tracking(referral_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_converted ON referral_tracking(converted, converted_at) WHERE converted = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_reservation ON referral_tracking(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_campaign ON referral_tracking(campaign_id) WHERE campaign_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_parent ON referral_tracking(parent_referral_id) WHERE parent_referral_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_rewards_issued ON referral_tracking(referrer_reward_issued, referee_reward_issued) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_suspicious ON referral_tracking(flagged_suspicious) WHERE flagged_suspicious = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_approval ON referral_tracking(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_metadata ON referral_tracking USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_tags ON referral_tracking USING gin(tags) WHERE is_deleted = FALSE;

CREATE INDEX idx_referral_tracking_property_status ON referral_tracking(property_id, referral_status, referred_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_referrer_performance ON referral_tracking(referrer_id, converted, revenue_generated DESC) WHERE is_deleted = FALSE;

COMMENT ON TABLE referral_tracking IS 'Tracks guest referrals, rewards, and referral program performance';
