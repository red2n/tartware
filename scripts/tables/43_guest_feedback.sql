-- Guest Feedback Table
-- Post-stay surveys, reviews, and ratings

CREATE TABLE IF NOT EXISTS guest_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    guest_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    feedback_source VARCHAR(50), -- 'EMAIL_SURVEY', 'SMS_SURVEY', 'IN_APP', 'GOOGLE', 'TRIPADVISOR', 'BOOKING_COM'
    overall_rating DECIMAL(3,2), -- 0.00 to 5.00 or 10.00
    rating_scale INTEGER DEFAULT 5, -- 5 or 10 point scale
    cleanliness_rating DECIMAL(3,2),
    staff_rating DECIMAL(3,2),
    location_rating DECIMAL(3,2),
    value_rating DECIMAL(3,2),
    amenities_rating DECIMAL(3,2),
    comfort_rating DECIMAL(3,2),
    facilities_rating DECIMAL(3,2),
    review_title VARCHAR(500),
    review_text TEXT,
    positive_comments TEXT,
    negative_comments TEXT,
    suggestions TEXT,
    would_recommend BOOLEAN,
    would_return BOOLEAN,
    sentiment_score DECIMAL(5,2), -- -1.00 to 1.00 (AI sentiment analysis)
    sentiment_label VARCHAR(20), -- 'POSITIVE', 'NEUTRAL', 'NEGATIVE'
    tags JSONB, -- Array of tags like ['clean', 'friendly staff', 'noisy']
    is_verified BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    response_text TEXT, -- Management response
    responded_by UUID,
    responded_at TIMESTAMP WITH TIME ZONE,
    external_review_id VARCHAR(200),
    external_review_url VARCHAR(500),
    language_code VARCHAR(10) DEFAULT 'en',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_guest_feedback_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_feedback_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_feedback_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_feedback_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_feedback_responded_by FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_guest_feedback_overall_rating CHECK (overall_rating >= 0 AND overall_rating <= rating_scale),
    CONSTRAINT chk_guest_feedback_sentiment CHECK (sentiment_score >= -1 AND sentiment_score <= 1)
);

-- Add comments
COMMENT ON TABLE guest_feedback IS 'Guest reviews, ratings, and feedback after their stay';
COMMENT ON COLUMN guest_feedback.feedback_source IS 'Source of feedback: EMAIL_SURVEY, SMS_SURVEY, IN_APP, GOOGLE, TRIPADVISOR, etc.';
COMMENT ON COLUMN guest_feedback.sentiment_score IS 'AI-calculated sentiment score from -1.00 (negative) to 1.00 (positive)';
COMMENT ON COLUMN guest_feedback.tags IS 'Array of extracted topics/tags from review';
COMMENT ON COLUMN guest_feedback.is_featured IS 'Mark as featured review for marketing';
