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


COMMENT ON TABLE referral_tracking IS 'Tracks guest referrals, rewards, and referral program performance';
COMMENT ON COLUMN referral_tracking.referral_id IS 'Unique identifier for the referral record';
COMMENT ON COLUMN referral_tracking.tenant_id IS 'Tenant owning this referral';
COMMENT ON COLUMN referral_tracking.referral_code IS 'Unique referral code shared by the referrer';
COMMENT ON COLUMN referral_tracking.referral_link IS 'Full URL containing the referral code for tracking';
COMMENT ON COLUMN referral_tracking.referrer_type IS 'Category of referrer (guest, staff, affiliate, influencer, partner)';
COMMENT ON COLUMN referral_tracking.referrer_id IS 'ID of the person making the referral';
COMMENT ON COLUMN referral_tracking.referrer_name IS 'Display name of the referrer';
COMMENT ON COLUMN referral_tracking.referee_id IS 'ID of the referred person once registered';
COMMENT ON COLUMN referral_tracking.referee_name IS 'Display name of the referred person';
COMMENT ON COLUMN referral_tracking.referral_status IS 'Current status in the referral lifecycle (pending through rewarded)';
COMMENT ON COLUMN referral_tracking.converted IS 'Whether the referee completed the desired conversion action';
COMMENT ON COLUMN referral_tracking.conversion_type IS 'Type of conversion achieved (booking, signup, purchase, etc.)';
COMMENT ON COLUMN referral_tracking.reservation_id IS 'Reservation created as a result of this referral';
COMMENT ON COLUMN referral_tracking.booking_amount IS 'Monetary value of the booking from this referral';
COMMENT ON COLUMN referral_tracking.referrer_reward_type IS 'Type of reward given to the referrer (discount, credit, points, etc.)';
COMMENT ON COLUMN referral_tracking.referrer_reward_amount IS 'Monetary value of the reward issued to the referrer';
COMMENT ON COLUMN referral_tracking.referrer_reward_issued IS 'Whether the referrer reward has been issued';
COMMENT ON COLUMN referral_tracking.referee_reward_type IS 'Type of reward given to the referee (welcome_bonus, discount, etc.)';
COMMENT ON COLUMN referral_tracking.referee_reward_amount IS 'Monetary value of the reward issued to the referee';
COMMENT ON COLUMN referral_tracking.referee_reward_issued IS 'Whether the referee reward has been issued';
COMMENT ON COLUMN referral_tracking.tier_level IS 'Level in a multi-tier referral chain (1 = direct referral)';
COMMENT ON COLUMN referral_tracking.parent_referral_id IS 'Parent referral in a multi-tier referral chain';
COMMENT ON COLUMN referral_tracking.campaign_id IS 'Marketing campaign this referral is associated with';
COMMENT ON COLUMN referral_tracking.referral_program_id IS 'Referral program governing the rules and rewards';
COMMENT ON COLUMN referral_tracking.source_channel IS 'Channel through which the referral was shared (email, social, etc.)';
COMMENT ON COLUMN referral_tracking.qualified IS 'Whether the referral has met all qualification criteria';
COMMENT ON COLUMN referral_tracking.minimum_booking_amount IS 'Minimum booking value required for the referral to qualify';
COMMENT ON COLUMN referral_tracking.link_clicks IS 'Number of times the referral link was clicked';
COMMENT ON COLUMN referral_tracking.revenue_generated IS 'Total revenue attributed to this referral';
COMMENT ON COLUMN referral_tracking.flagged_suspicious IS 'Whether this referral has been flagged for potential fraud';
COMMENT ON COLUMN referral_tracking.requires_approval IS 'Whether high-value rewards require manual approval';

\echo 'referral_tracking table created successfully!'
