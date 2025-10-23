-- =====================================================
-- Promotional Codes Table
-- =====================================================
-- Purpose: Manage promotional codes and discount coupons
-- Key Features:
--   - Code generation and validation
--   - Usage tracking
--   - Redemption limits
--   - Performance analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS promotional_codes (
    -- Primary Key
    promo_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Code Details
    promo_code VARCHAR(100) UNIQUE NOT NULL,
    promo_name VARCHAR(255) NOT NULL,
    promo_description TEXT,

    -- Type
    promo_type VARCHAR(100) CHECK (promo_type IN (
        'discount_percent', 'discount_fixed', 'free_night',
        'free_upgrade', 'free_service', 'bonus_points',
        'bundle_deal', 'early_bird', 'last_minute', 'other'
    )),

    -- Status
    promo_status VARCHAR(50) DEFAULT 'active' CHECK (promo_status IN (
        'draft', 'scheduled', 'active', 'paused', 'expired', 'depleted', 'cancelled'
    )),

    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,

    -- Validity Period
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,

    -- Discount Details
    discount_type VARCHAR(50) CHECK (discount_type IN (
        'percentage', 'fixed_amount', 'free_night', 'upgrade', 'other'
    )),

    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    discount_currency VARCHAR(3) DEFAULT 'USD',

    max_discount_amount DECIMAL(10,2),

    -- Free Nights
    free_nights_count INTEGER,
    free_nights_conditions TEXT,

    -- Usage Limits
    has_usage_limit BOOLEAN DEFAULT FALSE,
    total_usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    remaining_uses INTEGER,

    per_user_limit INTEGER DEFAULT 1,
    per_user_usage JSONB, -- {guest_id: count}

    -- Booking Requirements
    minimum_stay_nights INTEGER,
    maximum_stay_nights INTEGER,

    minimum_booking_amount DECIMAL(10,2),
    maximum_booking_amount DECIMAL(10,2),

    advance_booking_days_min INTEGER,
    advance_booking_days_max INTEGER,

    -- Applicable Dates
    applicable_check_in_from DATE,
    applicable_check_in_to DATE,

    blackout_dates DATE[],
    applicable_days_of_week INTEGER[], -- 0=Sunday, 6=Saturday

    -- Room/Rate Restrictions
    applicable_room_types UUID[],
    excluded_room_types UUID[],

    applicable_rate_codes VARCHAR(100)[],
    excluded_rate_codes VARCHAR(100)[],

    -- Service Restrictions
    applicable_to VARCHAR(100)[] DEFAULT ARRAY['rooms'], -- rooms, food, services, all
    excluded_services UUID[],

    -- Guest Eligibility
    eligible_guest_types VARCHAR(100)[] DEFAULT ARRAY['all'],
    eligible_loyalty_tiers VARCHAR(100)[],

    new_guests_only BOOLEAN DEFAULT FALSE,
    returning_guests_only BOOLEAN DEFAULT FALSE,

    -- Geographic Restrictions
    applicable_countries VARCHAR(3)[],
    excluded_countries VARCHAR(3)[],

    applicable_states VARCHAR(100)[],
    applicable_cities VARCHAR(100)[],

    -- Channel Restrictions
    applicable_channels VARCHAR(100)[] DEFAULT ARRAY['all'],
    excluded_channels VARCHAR(100)[],

    -- Combinability
    combinable_with_other_promos BOOLEAN DEFAULT FALSE,
    combinable_promo_codes VARCHAR(100)[],
    mutually_exclusive_codes VARCHAR(100)[],

    -- Campaign Association
    campaign_id UUID,
    marketing_source VARCHAR(100),

    -- Performance Tracking
    times_viewed INTEGER DEFAULT 0,
    times_applied INTEGER DEFAULT 0,
    times_redeemed INTEGER DEFAULT 0,

    total_discount_given DECIMAL(12,2) DEFAULT 0.00,
    total_revenue_generated DECIMAL(12,2) DEFAULT 0.00,

    conversion_rate DECIMAL(5,2),
    average_booking_value DECIMAL(10,2),

    -- Revenue Impact
    incremental_revenue DECIMAL(12,2),
    revenue_impact_percent DECIMAL(5,2),
    roi_percent DECIMAL(5,2),

    -- Validation Rules
    requires_minimum_guests INTEGER,
    requires_specific_addons VARCHAR(100)[],

    validation_rules JSONB,
    custom_validation_function TEXT,

    -- Auto-Apply
    auto_apply BOOLEAN DEFAULT FALSE,
    auto_apply_conditions JSONB,

    -- Notification
    display_on_website BOOLEAN DEFAULT FALSE,
    display_message TEXT,

    email_notification BOOLEAN DEFAULT FALSE,
    sms_notification BOOLEAN DEFAULT FALSE,

    -- Redemption Process
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_notes TEXT,

    redemption_notes TEXT,
    terms_and_conditions TEXT,

    -- Expiry Alerts
    alert_before_expiry_days INTEGER DEFAULT 7,
    expiry_alert_sent BOOLEAN DEFAULT FALSE,

    alert_on_depletion_threshold INTEGER,
    depletion_alert_sent BOOLEAN DEFAULT FALSE,

    -- Owner
    created_by_user_id UUID,
    owner_id UUID,

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


COMMENT ON TABLE promotional_codes IS 'Manages promotional codes, discounts, and usage tracking';
