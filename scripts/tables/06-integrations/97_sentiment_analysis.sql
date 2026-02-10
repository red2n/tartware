-- =============================================
-- Sentiment Analysis Table
-- =============================================
-- Description: AI-powered sentiment analysis of guest reviews and feedback
-- Dependencies: guests, reservations, guest_feedback
-- Category: Guest Intelligence - AI/ML
-- =============================================

CREATE TABLE IF NOT EXISTS sentiment_analysis (
    -- Primary Key
    sentiment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Source
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    feedback_id UUID REFERENCES guest_feedback(id) ON DELETE CASCADE,

    -- Content Source
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN (
        'guest_review',
        'survey_response',
        'email',
        'chat_transcript',
        'social_media',
        'phone_call_transcript',
        'complaint',
        'compliment',
        'comment_card',
        'online_review',
        'voice_feedback'
    )),

    source_platform VARCHAR(100), -- "TripAdvisor", "Google", "Booking.com", "Internal"
    source_url TEXT,
    source_reference VARCHAR(255),

    -- Original Content
    original_text TEXT NOT NULL,
    language_code VARCHAR(10),
    translated_text TEXT,

    -- Overall Sentiment
    overall_sentiment VARCHAR(50) NOT NULL CHECK (overall_sentiment IN (
        'very_positive',
        'positive',
        'neutral',
        'negative',
        'very_negative',
        'mixed'
    )),

    sentiment_score DECIMAL(5,2) NOT NULL, -- -100 to +100
    confidence_level DECIMAL(5,2), -- 0-100 (how confident the model is)

    -- Emotion Detection
    primary_emotion VARCHAR(50) CHECK (primary_emotion IN (
        'joy',
        'satisfaction',
        'excitement',
        'gratitude',
        'trust',
        'neutral',
        'disappointment',
        'frustration',
        'anger',
        'sadness',
        'disgust',
        'fear',
        'surprise'
    )),

    emotion_scores JSONB, -- {"joy": 0.85, "frustration": 0.15, ...}

    -- Aspect-Based Sentiment (Sentiment about specific aspects)
    room_sentiment DECIMAL(5,2), -- -100 to +100
    staff_sentiment DECIMAL(5,2),
    cleanliness_sentiment DECIMAL(5,2),
    food_sentiment DECIMAL(5,2),
    location_sentiment DECIMAL(5,2),
    amenities_sentiment DECIMAL(5,2),
    value_sentiment DECIMAL(5,2),
    checkin_sentiment DECIMAL(5,2),
    checkout_sentiment DECIMAL(5,2),

    aspect_sentiments JSONB, -- Detailed breakdown by aspect

    -- Key Phrases & Topics
    key_phrases TEXT[], -- Important phrases extracted
    topics TEXT[], -- Topics mentioned: "breakfast", "pool", "wifi", "parking"

    positive_keywords TEXT[],
    negative_keywords TEXT[],

    -- Specific Mentions
    staff_mentioned TEXT[], -- Names of staff mentioned
    room_number_mentioned VARCHAR(50),
    service_mentioned TEXT[], -- Services mentioned

    -- Urgency & Priority
    urgency_level VARCHAR(50) CHECK (urgency_level IN (
        'critical',
        'high',
        'medium',
        'low',
        'none'
    )),

    requires_response BOOLEAN DEFAULT FALSE,
    requires_immediate_action BOOLEAN DEFAULT FALSE,

    -- Issue Detection
    issues_detected TEXT[], -- "noise complaint", "billing error", "dirty room"
    issue_categories TEXT[], -- "housekeeping", "front_desk", "maintenance"

    compliments_detected TEXT[], -- "exceptional service", "beautiful view"

    -- Intent Detection
    customer_intent VARCHAR(50) CHECK (customer_intent IN (
        'complaint',
        'praise',
        'suggestion',
        'question',
        'request',
        'general_feedback',
        'mixed'
    )),

    -- Actionable Items
    action_items TEXT[], -- Extracted action items
    recommended_department VARCHAR(100), -- Which department should handle

    -- Comparison & Trends
    previous_sentiment_score DECIMAL(5,2), -- Guest's previous sentiment
    sentiment_trend VARCHAR(50) CHECK (sentiment_trend IN (
        'improving',
        'declining',
        'stable',
        'new_guest'
    )),

    -- Star Rating Prediction (if not provided)
    predicted_star_rating DECIMAL(2,1), -- 1.0 to 5.0
    actual_star_rating DECIMAL(2,1),

    -- NPS Classification
    nps_category VARCHAR(50) CHECK (nps_category IN (
        'promoter', -- 9-10
        'passive', -- 7-8
        'detractor' -- 0-6
    )),

    likelihood_to_recommend INTEGER, -- 0-10 scale

    -- ML Model Information
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    model_type VARCHAR(50) CHECK (model_type IN (
        'transformer',
        'bert',
        'gpt',
        'lstm',
        'naive_bayes',
        'lexicon_based',
        'hybrid',
        'ensemble'
    )),

    processing_time_ms INTEGER,

    -- Response Tracking
    response_generated BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_sent_at TIMESTAMP WITHOUT TIME ZONE,
    response_method VARCHAR(50), -- "email", "phone", "in_person"

    issue_resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    resolved_by UUID REFERENCES users(id),

    -- Review Metadata
    review_date DATE,
    stay_date DATE,
    days_since_stay INTEGER,

    is_verified_guest BOOLEAN DEFAULT FALSE,
    is_public_review BOOLEAN DEFAULT FALSE,
    review_helpful_count INTEGER DEFAULT 0,

    -- Moderation
    flagged_for_review BOOLEAN DEFAULT FALSE,
    flagged_reason TEXT,
    contains_profanity BOOLEAN DEFAULT FALSE,
    contains_personal_info BOOLEAN DEFAULT FALSE,

    moderation_status VARCHAR(50) CHECK (moderation_status IN (
        'pending',
        'approved',
        'rejected',
        'requires_review'
    )),

    -- Competitive Intelligence
    competitor_mentioned TEXT[], -- Competitor names mentioned
    competitive_comparison BOOLEAN DEFAULT FALSE,

    -- Notes
    analyst_notes TEXT,
    internal_notes TEXT,

    -- Audit Fields
    analyzed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    CHECK (sentiment_score >= -100 AND sentiment_score <= 100),
    CHECK (predicted_star_rating IS NULL OR (predicted_star_rating >= 1.0 AND predicted_star_rating <= 5.0))
);

-- =============================================
-- Sentiment Trends Table
-- =============================================

CREATE TABLE IF NOT EXISTS sentiment_trends (
    -- Primary Key
    trend_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Time Period
    trend_period VARCHAR(50) NOT NULL CHECK (trend_period IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'yearly'
    )),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Overall Metrics
    total_reviews INTEGER DEFAULT 0,
    total_feedbacks INTEGER DEFAULT 0,

    average_sentiment_score DECIMAL(5,2),
    median_sentiment_score DECIMAL(5,2),

    positive_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,

    positive_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_reviews > 0 THEN (positive_count::DECIMAL / total_reviews) * 100
            ELSE NULL
        END
    ) STORED,

    -- Aspect Averages
    avg_room_sentiment DECIMAL(5,2),
    avg_staff_sentiment DECIMAL(5,2),
    avg_cleanliness_sentiment DECIMAL(5,2),
    avg_food_sentiment DECIMAL(5,2),
    avg_location_sentiment DECIMAL(5,2),
    avg_amenities_sentiment DECIMAL(5,2),
    avg_value_sentiment DECIMAL(5,2),

    -- Top Topics
    trending_topics JSONB, -- Topics that are trending up/down
    top_positive_keywords TEXT[],
    top_negative_keywords TEXT[],

    -- Issues
    top_issues TEXT[],
    issue_frequency JSONB, -- {"noise": 15, "wifi": 10, ...}

    -- NPS Metrics
    promoter_count INTEGER DEFAULT 0,
    passive_count INTEGER DEFAULT 0,
    detractor_count INTEGER DEFAULT 0,

    nps_score INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN (promoter_count + passive_count + detractor_count) > 0
            THEN ((promoter_count - detractor_count)::DECIMAL / (promoter_count + passive_count + detractor_count)) * 100
            ELSE NULL
        END
    ) STORED,

    -- Comparison
    previous_period_sentiment DECIMAL(5,2),
    sentiment_change DECIMAL(5,2),
    trend_direction VARCHAR(50) CHECK (trend_direction IN (
        'improving',
        'declining',
        'stable'
    )),

    -- Notes
    insights TEXT,
    action_items TEXT[],

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- =============================================
-- Review Response Templates
-- =============================================

CREATE TABLE IF NOT EXISTS review_response_templates (
    -- Primary Key
    template_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Template Details
    template_name VARCHAR(255) NOT NULL,
    template_description TEXT,

    -- Applicability
    sentiment_type VARCHAR(50) CHECK (sentiment_type IN (
        'very_positive',
        'positive',
        'neutral',
        'negative',
        'very_negative',
        'any'
    )),

    issue_categories TEXT[], -- Which types of issues this template addresses

    -- Template Content
    template_text TEXT NOT NULL,

    -- Personalization Tokens
    available_tokens TEXT[], -- ["{guest_name}", "{stay_date}", "{issue}"]

    -- Usage
    use_count INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(5,2), -- Based on guest responses

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);


COMMENT ON TABLE sentiment_analysis IS 'AI-powered sentiment analysis of guest reviews, feedback, and communications with aspect-based scoring';
COMMENT ON TABLE sentiment_trends IS 'Aggregated sentiment trends over time with NPS scoring and issue tracking';
COMMENT ON TABLE review_response_templates IS 'Pre-built response templates for different sentiment types and issues';
COMMENT ON COLUMN sentiment_analysis.sentiment_score IS 'Overall sentiment score from -100 (very negative) to +100 (very positive)';
COMMENT ON COLUMN sentiment_analysis.aspect_sentiments IS 'JSON breakdown of sentiment by specific aspects (room, staff, cleanliness, etc.)';
COMMENT ON COLUMN sentiment_analysis.emotion_scores IS 'ML-detected emotions with confidence scores';
COMMENT ON COLUMN sentiment_trends.nps_score IS 'Net Promoter Score calculated from promoter and detractor counts (computed)';

\echo 'sentiment_analysis table created successfully!'
