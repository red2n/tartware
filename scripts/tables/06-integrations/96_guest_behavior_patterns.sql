-- =============================================
-- Guest Behavior Patterns Table
-- =============================================
-- Description: AI-powered guest behavior analytics and pattern recognition
-- Dependencies: guests, reservations, properties
-- Category: Guest Intelligence - AI/ML
-- =============================================

CREATE TABLE IF NOT EXISTS guest_behavior_patterns (
    -- Primary Key
    pattern_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Guest
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,

    -- Analysis Period
    analysis_date DATE DEFAULT CURRENT_DATE,
    first_stay_date DATE,
    last_stay_date DATE,
    total_stays INTEGER DEFAULT 0,

    -- Booking Behavior
    average_booking_lead_time INTEGER, -- Days in advance
    preferred_booking_channel VARCHAR(50),
    booking_channel_distribution JSONB, -- {"direct": 60, "ota": 30, "phone": 10}

    typical_booking_time VARCHAR(50), -- "morning", "afternoon", "evening", "night"
    books_on_weekdays BOOLEAN,
    books_on_weekends BOOLEAN,

    price_sensitivity VARCHAR(50) CHECK (price_sensitivity IN (
        'very_high',
        'high',
        'medium',
        'low',
        'very_low'
    )),
    average_rate_paid DECIMAL(10,2),
    discount_usage_rate DECIMAL(5,2), -- % of bookings with discount

    -- Stay Patterns
    preferred_stay_duration INTEGER, -- Most common length of stay
    average_stay_duration DECIMAL(5,2),
    min_stay_duration INTEGER,
    max_stay_duration INTEGER,

    preferred_check_in_day VARCHAR(10),
    preferred_check_out_day VARCHAR(10),
    check_in_day_distribution JSONB, -- {"Monday": 15, "Friday": 60, ...}

    seasonality_pattern VARCHAR(50) CHECK (seasonality_pattern IN (
        'summer_traveler',
        'winter_traveler',
        'year_round',
        'shoulder_season',
        'holiday_only',
        'business_regular'
    )),

    -- Room Preferences
    preferred_room_type_id UUID REFERENCES room_types(id),
    room_type_preferences JSONB, -- {"suite": 70, "deluxe": 30}

    preferred_floor VARCHAR(50), -- "high", "low", "middle"
    preferred_view VARCHAR(50), -- "ocean", "city", "garden"
    preferred_bed_type VARCHAR(50), -- "king", "double", "twin"

    upgrades_accepted INTEGER DEFAULT 0,
    upgrade_acceptance_rate DECIMAL(5,2),

    -- Travel Patterns
    travel_purpose VARCHAR(50) CHECK (travel_purpose IN (
        'leisure',
        'business',
        'mixed',
        'group',
        'family',
        'romantic',
        'solo'
    )),

    typical_party_size INTEGER,
    travels_with_children BOOLEAN DEFAULT FALSE,
    travels_with_pets BOOLEAN DEFAULT FALSE,

    origin_country VARCHAR(100),
    origin_city VARCHAR(100),
    is_local_guest BOOLEAN DEFAULT FALSE,
    is_international_guest BOOLEAN DEFAULT FALSE,

    -- Service Preferences
    dining_preferences JSONB, -- {"breakfast": true, "room_service": true, ...}
    spa_service_usage_rate DECIMAL(5,2),
    amenity_usage_patterns JSONB, -- {"gym": 80, "pool": 60, "business_center": 40}

    concierge_service_usage INTEGER DEFAULT 0,
    transportation_preferences JSONB, -- {"airport_shuttle": true, "rental_car": false}

    -- Communication Preferences
    preferred_contact_method VARCHAR(50), -- "email", "sms", "phone", "app"
    response_rate DECIMAL(5,2), -- How often they respond to communications
    average_response_time_hours INTEGER,

    prefers_digital_checkin BOOLEAN DEFAULT FALSE,
    uses_mobile_app BOOLEAN DEFAULT FALSE,

    -- Spending Behavior
    total_lifetime_value DECIMAL(12,2) DEFAULT 0.00,
    average_total_spend_per_stay DECIMAL(10,2),

    room_revenue_percentage DECIMAL(5,2),
    food_beverage_revenue_percentage DECIMAL(5,2),
    spa_revenue_percentage DECIMAL(5,2),
    other_revenue_percentage DECIMAL(5,2),

    ancillary_spend_propensity VARCHAR(50) CHECK (ancillary_spend_propensity IN (
        'very_high',
        'high',
        'medium',
        'low',
        'very_low'
    )),

    -- Loyalty Indicators
    repeat_guest_score DECIMAL(5,2), -- 0-100
    loyalty_tier VARCHAR(50),
    months_since_last_stay INTEGER,

    churn_risk_score DECIMAL(5,2), -- 0-100 (likelihood of not returning)
    churn_risk_level VARCHAR(50) CHECK (churn_risk_level IN (
        'very_low',
        'low',
        'medium',
        'high',
        'very_high'
    )),

    referral_count INTEGER DEFAULT 0,
    is_brand_advocate BOOLEAN DEFAULT FALSE,

    -- Satisfaction & Feedback
    average_satisfaction_score DECIMAL(3,2), -- 1-5 scale
    nps_score INTEGER, -- Net Promoter Score (-100 to 100)

    total_reviews_submitted INTEGER DEFAULT 0,
    average_review_rating DECIMAL(3,2),
    review_sentiment_score DECIMAL(5,2), -- -100 to 100

    complaint_count INTEGER DEFAULT 0,
    compliment_count INTEGER DEFAULT 0,

    -- Behavioral Traits
    is_early_adopter BOOLEAN DEFAULT FALSE, -- Tries new services/features quickly
    is_high_maintenance BOOLEAN DEFAULT FALSE,
    is_low_touch BOOLEAN DEFAULT FALSE, -- Minimal service requests

    special_occasion_traveler BOOLEAN DEFAULT FALSE, -- Birthdays, anniversaries
    celebration_count INTEGER DEFAULT 0,

    -- Cancellation Behavior
    cancellation_rate DECIMAL(5,2),
    average_cancellation_lead_time INTEGER, -- Days before arrival
    no_show_count INTEGER DEFAULT 0,

    -- Predictive Scores (ML-generated)
    upsell_propensity_score DECIMAL(5,2), -- 0-100
    cross_sell_propensity_score DECIMAL(5,2),
    premium_service_affinity DECIMAL(5,2),

    next_booking_probability DECIMAL(5,2), -- Likelihood to book in next 90 days
    predicted_next_booking_date DATE,
    predicted_ltv_next_12_months DECIMAL(12,2),

    -- Segmentation
    customer_segment VARCHAR(50) CHECK (customer_segment IN (
        'vip',
        'frequent_business',
        'leisure_regular',
        'occasional',
        'first_timer',
        'bargain_hunter',
        'luxury_seeker',
        'family_focused',
        'group_leader',
        'at_risk'
    )),

    value_segment VARCHAR(50) CHECK (value_segment IN (
        'high_value',
        'medium_value',
        'low_value',
        'growing',
        'declining'
    )),

    -- Model Information
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    confidence_score DECIMAL(5,2),
    last_analyzed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    UNIQUE (guest_id, analysis_date)
);

-- =============================================
-- Personalized Recommendations Table
-- =============================================

CREATE TABLE IF NOT EXISTS personalized_recommendations (
    -- Primary Key
    recommendation_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Guest
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,

    -- Recommendation Details
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN (
        'room_upgrade',
        'package',
        'service',
        'amenity',
        'dining',
        'spa',
        'activity',
        'transportation',
        'special_offer',
        'loyalty_reward',
        'cross_property'
    )),

    recommendation_title VARCHAR(255) NOT NULL,
    recommendation_description TEXT,

    -- What we're recommending
    recommended_item_id UUID, -- Generic ID (could be room_type, package, service, etc.)
    recommended_item_type VARCHAR(50), -- "room_type", "package", "service"

    -- Pricing
    regular_price DECIMAL(10,2),
    recommended_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),

    -- Why this recommendation
    reasoning TEXT,
    based_on_factors TEXT[], -- ["past_bookings", "similar_guests", "current_promotion"]

    -- ML Model Info
    ml_model_name VARCHAR(100),
    confidence_score DECIMAL(5,2), -- How confident the model is (0-100)
    relevance_score DECIMAL(5,2), -- How relevant to guest (0-100)

    personalization_factors JSONB, -- Which guest behaviors/preferences drove this

    -- Timing
    recommended_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITHOUT TIME ZONE,

    delivery_channel VARCHAR(50) CHECK (delivery_channel IN (
        'email',
        'sms',
        'mobile_app',
        'website',
        'in_person',
        'chatbot',
        'pre_arrival',
        'in_stay',
        'post_stay'
    )),
    delivery_timing VARCHAR(50) CHECK (delivery_timing IN (
        'at_booking',
        'pre_arrival',
        'at_checkin',
        'during_stay',
        'at_checkout',
        'post_stay',
        'abandoned_cart',
        'win_back'
    )),

    -- Guest Response
    presented_to_guest BOOLEAN DEFAULT FALSE,
    presented_at TIMESTAMP WITHOUT TIME ZONE,

    guest_action VARCHAR(50) CHECK (guest_action IN (
        'accepted',
        'declined',
        'viewed',
        'clicked',
        'ignored',
        'purchased',
        'added_to_cart',
        'pending'
    )),
    action_taken_at TIMESTAMP WITHOUT TIME ZONE,

    -- Conversion
    converted BOOLEAN DEFAULT FALSE,
    conversion_value DECIMAL(10,2),

    -- A/B Testing
    experiment_id UUID,
    variant VARCHAR(50), -- "control", "test_a", "test_b"

    -- Performance
    click_through_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),

    -- Notes
    guest_feedback TEXT,
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- =============================================
-- Guest Interaction Events
-- =============================================

CREATE TABLE IF NOT EXISTS guest_interaction_events (
    -- Primary Key
    event_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Guest
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,

    -- Event Details
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'website_visit',
        'search',
        'room_view',
        'rate_check',
        'booking_started',
        'booking_abandoned',
        'booking_completed',
        'email_opened',
        'email_clicked',
        'sms_received',
        'app_opened',
        'review_submitted',
        'service_requested',
        'complaint_filed',
        'feedback_given',
        'loyalty_enrolled',
        'referral_made',
        'social_media_mention',
        'chat_initiated',
        'phone_call'
    )),

    event_timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_source VARCHAR(50), -- "website", "mobile_app", "email", "front_desk"

    -- Event Context
    session_id VARCHAR(100),
    device_type VARCHAR(50), -- "desktop", "mobile", "tablet"
    browser VARCHAR(50),
    operating_system VARCHAR(50),

    page_url TEXT,
    referrer_url TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Event Data
    event_data JSONB, -- Flexible storage for event-specific data

    -- Geolocation
    ip_address VARCHAR(45),
    country VARCHAR(100),
    city VARCHAR(100),

    -- Engagement Metrics
    time_spent_seconds INTEGER,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


COMMENT ON TABLE guest_behavior_patterns IS 'AI-powered analysis of guest behavior, preferences, and predictive scores for personalization';
COMMENT ON TABLE personalized_recommendations IS 'ML-generated personalized recommendations for upsells, cross-sells, and services';
COMMENT ON TABLE guest_interaction_events IS 'Event tracking for all guest interactions across digital and physical touchpoints';
COMMENT ON COLUMN guest_behavior_patterns.churn_risk_score IS 'ML-predicted likelihood guest will not return (0-100)';
COMMENT ON COLUMN guest_behavior_patterns.upsell_propensity_score IS 'ML score indicating likelihood to purchase upgrades/add-ons';
COMMENT ON COLUMN personalized_recommendations.personalization_factors IS 'JSON showing which guest behaviors/preferences drove this recommendation';

\echo 'guest_behavior_patterns table created successfully!'

\echo 'guest_behavior_patterns table created successfully!'

\echo 'guest_behavior_patterns table created successfully!'
