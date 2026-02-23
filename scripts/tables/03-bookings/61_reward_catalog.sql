-- =====================================================
-- 61_reward_catalog.sql
-- Reward Catalog — available rewards guests can redeem loyalty points for
-- Industry Standard: HTNG Loyalty / AHLA Guest Loyalty Programs
-- Pattern: Config + Redemption (two-table design)
-- Date: 2026-02-23
-- =====================================================

-- =====================================================
-- REWARD_CATALOG TABLE
-- Available rewards that guests can redeem loyalty points for
-- =====================================================

CREATE TABLE IF NOT EXISTS reward_catalog (
    -- Primary Key
    reward_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique reward identifier

    -- Multi-Tenancy
    tenant_id UUID NOT NULL, -- Owning tenant
    property_id UUID, -- NULL = available across all properties

    -- Reward Definition
    reward_code VARCHAR(50) NOT NULL, -- Unique code per tenant (e.g., 'FREE_NIGHT', 'SPA_50')
    reward_name VARCHAR(200) NOT NULL, -- Display name for guest-facing UI
    reward_description TEXT, -- Full description of the reward
    reward_category VARCHAR(50) NOT NULL CHECK (reward_category IN (
        'room_upgrade', 'free_night', 'food_beverage', 'spa',
        'amenity', 'experience', 'merchandise', 'discount',
        'late_checkout', 'early_checkin', 'airport_transfer', 'other'
    )), -- Reward classification

    -- Points Cost
    points_required INTEGER NOT NULL CHECK (points_required > 0), -- Points needed to redeem
    points_variable BOOLEAN DEFAULT FALSE, -- TRUE = points scale with value (e.g., room rate)
    points_per_currency_unit DECIMAL(8,2), -- For variable: points per $1 of value

    -- Value
    reward_value DECIMAL(10,2), -- Monetary value of the reward (for accounting)
    currency VARCHAR(3) DEFAULT 'USD', -- Currency for reward_value

    -- Availability Rules
    is_active BOOLEAN DEFAULT TRUE, -- Whether reward is currently available
    available_from DATE, -- Start of availability window
    available_to DATE, -- End of availability window
    max_redemptions_per_guest INTEGER, -- NULL = unlimited
    max_total_redemptions INTEGER, -- NULL = unlimited
    current_redemption_count INTEGER DEFAULT 0, -- Running total of redemptions
    min_tier VARCHAR(20) CHECK (min_tier IN (
        'bronze', 'silver', 'gold', 'platinum', 'diamond', 'elite'
    )), -- Minimum loyalty tier required (NULL = any tier)
    blackout_dates JSONB DEFAULT '[]', -- Array of date ranges not available
    day_of_week_restrictions INTEGER[], -- 0=Sun ... 6=Sat; NULL = all days

    -- Fulfillment
    fulfillment_type VARCHAR(50) DEFAULT 'automatic' CHECK (fulfillment_type IN (
        'automatic', 'manual', 'approval_required', 'voucher'
    )), -- How the reward is delivered
    fulfillment_instructions TEXT, -- Staff instructions for manual fulfillment
    voucher_template_id UUID, -- Template for voucher-based rewards

    -- Display
    image_url TEXT, -- Reward image for catalog display
    sort_order INTEGER DEFAULT 0, -- Ordering in catalog UI
    featured BOOLEAN DEFAULT FALSE, -- Highlighted in catalog

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Constraints
    UNIQUE (tenant_id, reward_code)
);

-- =====================================================
-- REWARD_REDEMPTIONS TABLE
-- Records of guest reward redemptions
-- =====================================================

CREATE TABLE IF NOT EXISTS reward_redemptions (
    -- Primary Key
    redemption_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique redemption identifier

    -- Multi-Tenancy
    tenant_id UUID NOT NULL, -- Owning tenant
    property_id UUID NOT NULL, -- Property where redeemed

    -- References
    reward_id UUID NOT NULL REFERENCES reward_catalog(reward_id), -- Which reward
    program_id UUID NOT NULL, -- FK to guest_loyalty_programs
    guest_id UUID NOT NULL, -- Who redeemed
    reservation_id UUID, -- Associated reservation if applicable

    -- Redemption Details
    redemption_code VARCHAR(100) NOT NULL, -- Unique code for this redemption
    points_spent INTEGER NOT NULL CHECK (points_spent > 0), -- Points deducted
    reward_value DECIMAL(10,2), -- Monetary value at time of redemption
    currency VARCHAR(3) DEFAULT 'USD', -- Currency

    -- Status
    redemption_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (redemption_status IN (
        'pending', 'approved', 'fulfilled', 'cancelled', 'expired', 'rejected'
    )), -- Lifecycle status

    -- Fulfillment
    fulfilled_at TIMESTAMPTZ, -- When the reward was delivered
    fulfilled_by UUID, -- Staff who fulfilled
    fulfillment_notes TEXT, -- Notes from fulfillment

    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,
    cancellation_reason TEXT,
    points_refunded BOOLEAN DEFAULT FALSE, -- Were points returned on cancel

    -- Expiry
    expires_at TIMESTAMPTZ, -- When unused redemption expires
    expired BOOLEAN DEFAULT FALSE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Constraints
    UNIQUE (tenant_id, redemption_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reward_catalog_tenant_active
  ON reward_catalog (tenant_id, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_reward_catalog_category
  ON reward_catalog (tenant_id, reward_category);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_guest
  ON reward_redemptions (tenant_id, guest_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_program
  ON reward_redemptions (tenant_id, program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_status
  ON reward_redemptions (tenant_id, redemption_status);

-- Table Comments
COMMENT ON TABLE reward_catalog IS 'Available rewards that guests can redeem loyalty points for — room upgrades, free nights, amenities, experiences';
COMMENT ON TABLE reward_redemptions IS 'Records of guest loyalty point redemptions against the reward catalog';

-- Column Comments
COMMENT ON COLUMN reward_catalog.reward_code IS 'Unique reward identifier within a tenant (e.g., FREE_NIGHT, SPA_CREDIT_50)';
COMMENT ON COLUMN reward_catalog.points_required IS 'Number of loyalty points required to redeem this reward';
COMMENT ON COLUMN reward_catalog.min_tier IS 'Minimum loyalty tier needed to access this reward (NULL = any tier)';
COMMENT ON COLUMN reward_catalog.blackout_dates IS 'JSON array of {from, to} date ranges when reward is not available';
COMMENT ON COLUMN reward_redemptions.redemption_code IS 'Unique code generated for each redemption — used for tracking and vouchers';
COMMENT ON COLUMN reward_redemptions.points_spent IS 'Number of loyalty points deducted from the guest balance';
COMMENT ON COLUMN reward_redemptions.redemption_status IS 'Lifecycle: pending → approved → fulfilled (or cancelled/expired/rejected)';

\echo 'reward_catalog and reward_redemptions tables created successfully!'
