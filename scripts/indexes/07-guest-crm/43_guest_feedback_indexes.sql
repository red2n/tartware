-- Indexes for guest_feedback table

-- Primary lookup indexes
CREATE INDEX idx_guest_feedback_tenant_property
    ON guest_feedback(tenant_id, property_id);

CREATE INDEX idx_guest_feedback_guest
    ON guest_feedback(guest_id, created_at DESC);

CREATE INDEX idx_guest_feedback_reservation
    ON guest_feedback(reservation_id);

-- Rating indexes
CREATE INDEX idx_guest_feedback_overall_rating
    ON guest_feedback(property_id, overall_rating DESC, created_at DESC);

CREATE INDEX idx_guest_feedback_high_ratings
    ON guest_feedback(property_id, overall_rating DESC, created_at DESC)
    WHERE overall_rating >= 4.0 AND is_public = true;

CREATE INDEX idx_guest_feedback_low_ratings
    ON guest_feedback(property_id, overall_rating, created_at DESC)
    WHERE overall_rating < 3.0;

-- Individual rating categories
CREATE INDEX idx_guest_feedback_cleanliness ON guest_feedback(cleanliness_rating DESC);
CREATE INDEX idx_guest_feedback_staff ON guest_feedback(staff_rating DESC);
CREATE INDEX idx_guest_feedback_location ON guest_feedback(location_rating DESC);
CREATE INDEX idx_guest_feedback_value ON guest_feedback(value_rating DESC);

-- Sentiment analysis
CREATE INDEX idx_guest_feedback_sentiment_score
    ON guest_feedback(sentiment_score DESC, created_at DESC);

CREATE INDEX idx_guest_feedback_sentiment_label
    ON guest_feedback(sentiment_label, created_at DESC);

CREATE INDEX idx_guest_feedback_negative_sentiment
    ON guest_feedback(property_id, sentiment_score, created_at DESC)
    WHERE sentiment_label = 'NEGATIVE';

-- Source tracking
CREATE INDEX idx_guest_feedback_source
    ON guest_feedback(feedback_source, created_at DESC);

-- Public/featured reviews
CREATE INDEX idx_guest_feedback_public
    ON guest_feedback(property_id, is_public, overall_rating DESC, created_at DESC)
    WHERE is_public = true;

CREATE INDEX idx_guest_feedback_featured
    ON guest_feedback(property_id, is_featured, created_at DESC)
    WHERE is_featured = true;

-- Verified reviews
CREATE INDEX idx_guest_feedback_verified
    ON guest_feedback(is_verified, created_at DESC)
    WHERE is_verified = true;

-- Recommendation tracking
CREATE INDEX idx_guest_feedback_recommend
    ON guest_feedback(property_id, would_recommend, created_at DESC)
    WHERE would_recommend IS NOT NULL;

CREATE INDEX idx_guest_feedback_return
    ON guest_feedback(property_id, would_return, created_at DESC)
    WHERE would_return IS NOT NULL;

-- Response tracking
CREATE INDEX idx_guest_feedback_needs_response
    ON guest_feedback(property_id, created_at)
    WHERE response_text IS NULL AND overall_rating < 3.0;

CREATE INDEX idx_guest_feedback_responded
    ON guest_feedback(responded_at DESC, responded_by)
    WHERE responded_at IS NOT NULL;

CREATE INDEX idx_guest_feedback_responded_by
    ON guest_feedback(responded_by);

-- External review tracking
CREATE INDEX idx_guest_feedback_external_id
    ON guest_feedback(external_review_id)
    WHERE external_review_id IS NOT NULL;

-- Language
CREATE INDEX idx_guest_feedback_language
    ON guest_feedback(language_code);

-- Timestamp indexes
CREATE INDEX idx_guest_feedback_created_at ON guest_feedback(created_at DESC);
CREATE INDEX idx_guest_feedback_updated_at ON guest_feedback(updated_at DESC);

-- Full-text search on reviews
CREATE INDEX idx_guest_feedback_review_text
    ON guest_feedback USING gin(to_tsvector('english', review_text))
    WHERE review_text IS NOT NULL;

CREATE INDEX idx_guest_feedback_review_title
    ON guest_feedback USING gin(to_tsvector('english', review_title))
    WHERE review_title IS NOT NULL;

-- GIN indexes for JSONB
CREATE INDEX idx_guest_feedback_tags ON guest_feedback USING gin(tags);
CREATE INDEX idx_guest_feedback_metadata ON guest_feedback USING gin(metadata);

-- Composite index for property performance
CREATE INDEX idx_guest_feedback_property_performance
    ON guest_feedback(property_id, created_at DESC, overall_rating DESC, is_public)
    WHERE is_verified = true;

-- Average rating calculation index
CREATE INDEX idx_guest_feedback_property_avg
    ON guest_feedback(property_id, overall_rating, created_at)
    WHERE is_public = true AND is_verified = true;
