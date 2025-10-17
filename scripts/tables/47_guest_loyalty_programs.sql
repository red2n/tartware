-- =====================================================
-- Guest Loyalty Programs Table
-- =====================================================
-- Purpose: Manage guest loyalty memberships, tiers, and rewards
-- Key Features:
--   - Multi-tier loyalty programs
--   - Points tracking and expiry
--   - Tier progression tracking
--   - Benefits management
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_loyalty_programs (
    -- Primary Key
    program_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Guest Reference
    guest_id UUID NOT NULL,

    -- Program Details
    program_name VARCHAR(100) NOT NULL,
    program_tier VARCHAR(50) CHECK (program_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'elite')),
    membership_number VARCHAR(100) UNIQUE,
    membership_status VARCHAR(50) DEFAULT 'active' CHECK (membership_status IN ('active', 'inactive', 'suspended', 'expired', 'cancelled')),

    -- Points System
    points_balance INTEGER DEFAULT 0,
    points_earned_lifetime INTEGER DEFAULT 0,
    points_redeemed_lifetime INTEGER DEFAULT 0,
    points_expired_lifetime INTEGER DEFAULT 0,
    points_expiring_soon INTEGER DEFAULT 0,
    points_expiry_date DATE,

    -- Tier Management
    tier_status VARCHAR(50),
    tier_start_date DATE,
    tier_expiry_date DATE,
    tier_qualification_date DATE,
    nights_to_next_tier INTEGER,
    points_to_next_tier INTEGER,
    stays_to_next_tier INTEGER,

    -- Activity Tracking
    total_stays INTEGER DEFAULT 0,
    total_nights INTEGER DEFAULT 0,
    total_spend DECIMAL(12,2) DEFAULT 0.00,
    last_stay_date DATE,
    last_points_earned_date DATE,
    last_points_redeemed_date DATE,

    -- Enrollment
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    enrollment_channel VARCHAR(50) CHECK (enrollment_channel IN ('web', 'mobile', 'property', 'phone', 'email', 'referral')),
    enrollment_property_id UUID,
    referred_by_guest_id UUID,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_date DATE,
    inactivity_warning_sent BOOLEAN DEFAULT FALSE,
    reactivation_date DATE,

    -- Benefits & Preferences
    benefits JSONB, -- {free_wifi, late_checkout, room_upgrade, etc}
    tier_benefits JSONB,
    special_privileges JSONB,
    preferences JSONB, -- {room_type, floor, view, amenities}

    -- Anniversary & Rewards
    anniversary_date DATE,
    birthday_bonus_claimed BOOLEAN DEFAULT FALSE,
    anniversary_bonus_claimed BOOLEAN DEFAULT FALSE,

    -- Communication Preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    push_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT TRUE,

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

-- Indexes for guest_loyalty_programs
CREATE INDEX idx_guest_loyalty_programs_tenant ON guest_loyalty_programs(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_property ON guest_loyalty_programs(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_guest ON guest_loyalty_programs(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_membership ON guest_loyalty_programs(membership_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_tier ON guest_loyalty_programs(program_tier) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_status ON guest_loyalty_programs(membership_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_active ON guest_loyalty_programs(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_points ON guest_loyalty_programs(points_balance) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_expiry ON guest_loyalty_programs(points_expiry_date) WHERE points_expiry_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_tier_expiry ON guest_loyalty_programs(tier_expiry_date) WHERE tier_expiry_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_enrollment ON guest_loyalty_programs(enrollment_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_last_activity ON guest_loyalty_programs(last_activity_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_benefits ON guest_loyalty_programs USING gin(benefits) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_preferences ON guest_loyalty_programs USING gin(preferences) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_metadata ON guest_loyalty_programs USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_tags ON guest_loyalty_programs USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_guest_loyalty_programs_tenant_tier ON guest_loyalty_programs(tenant_id, program_tier) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_guest_active ON guest_loyalty_programs(guest_id, is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_property_tier ON guest_loyalty_programs(property_id, program_tier, points_balance DESC) WHERE is_deleted = FALSE;

-- Comments
COMMENT ON TABLE guest_loyalty_programs IS 'Manages guest loyalty program memberships, tiers, points, and benefits';
COMMENT ON COLUMN guest_loyalty_programs.program_tier IS 'Loyalty tier level: bronze, silver, gold, platinum, diamond, elite';
COMMENT ON COLUMN guest_loyalty_programs.points_balance IS 'Current available points balance';
COMMENT ON COLUMN guest_loyalty_programs.benefits IS 'JSON object containing tier-specific benefits and privileges';
