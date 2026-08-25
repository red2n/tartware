-- =====================================================
-- guest_feedback.sql
-- Guest Feedback Table
-- Industry Standard: CRM guest satisfaction tracking
-- Pattern: Post-stay surveys, reviews, and ratings
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- GUEST_FEEDBACK TABLE
-- Post-stay surveys, reviews, and ratings
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_feedback (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    guest_id UUID NOT NULL,
    reservation_id UUID NOT NULL,

    -- Feedback Source
    feedback_source VARCHAR(50), -- 'EMAIL_SURVEY', 'SMS_SURVEY', 'IN_APP', 'GOOGLE', 'TRIPADVISOR', 'BOOKING_COM'

    -- Overall Rating
    overall_rating DECIMAL(3,2), -- 0.00 to 5.00 or 10.00
    rating_scale INTEGER DEFAULT 5, -- 5 or 10 point scale

    -- Detailed Ratings
    cleanliness_rating DECIMAL(3,2),
    staff_rating DECIMAL(3,2),
    location_rating DECIMAL(3,2),
    value_rating DECIMAL(3,2),
    amenities_rating DECIMAL(3,2),
    comfort_rating DECIMAL(3,2),
    facilities_rating DECIMAL(3,2),

    -- Review Content
    review_title VARCHAR(500),
    review_text TEXT,
    positive_comments TEXT,
    negative_comments TEXT,
    suggestions TEXT,

    -- Guest Intent
    would_recommend BOOLEAN,
    would_return BOOLEAN,

    -- Sentiment Analysis (AI-powered)
    sentiment_score DECIMAL(5,2), -- -1.00 to 1.00 (AI sentiment analysis)
    sentiment_label VARCHAR(20), -- 'POSITIVE', 'NEUTRAL', 'NEGATIVE'
    tags JSONB, -- Array of tags like ['clean', 'friendly staff', 'noisy']

    -- Publication Status
    is_verified BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,

    -- Management Response
    response_text TEXT, -- Management response
    responded_by UUID,
    responded_at TIMESTAMP WITH TIME ZONE,

    -- Complaint handling workflow
    -- Feedback with no owner and no status is a table that fills up and is never
    -- worked. These carry the response loop: triage → assign → respond → resolve.
    feedback_status VARCHAR(30) NOT NULL DEFAULT 'new', -- new | acknowledged | in_progress | responded | resolved | closed
    feedback_category VARCHAR(100), -- Free-form triage bucket: 'housekeeping', 'noise', 'billing', …
    assigned_to UUID, -- User who owns getting this to a resolution
    assigned_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT, -- What was done about it
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    service_recovery_reference VARCHAR(200), -- Comp posting or gesture recorded against the complaint

    -- External Review Integration
    external_review_id VARCHAR(200),
    external_review_url VARCHAR(500),

    -- Localization
    language_code VARCHAR(10) DEFAULT 'en',

    -- Additional Data
    metadata JSONB,

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_guest_feedback_overall_rating CHECK (overall_rating >= 0 AND overall_rating <= rating_scale),
    CONSTRAINT chk_guest_feedback_sentiment CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    CONSTRAINT chk_guest_feedback_status CHECK (feedback_status IN (
        'new', 'acknowledged', 'in_progress', 'responded', 'resolved', 'closed'
    ))
);

-- =====================================================
-- Additive columns for existing installations.
--
-- The table shipped with no workflow columns and with guest_id/reservation_id
-- NOT NULL, which made staff-entered feedback impossible: a phone complaint from
-- someone who is not yet in the system has neither. See ui-gaps/09-guest-feedback.md.
-- =====================================================

ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS feedback_status VARCHAR(30) NOT NULL DEFAULT 'new';
ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS feedback_category VARCHAR(100);
ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS resolved_by UUID;
ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE guest_feedback ADD COLUMN IF NOT EXISTS service_recovery_reference VARCHAR(200);

ALTER TABLE guest_feedback ALTER COLUMN guest_id DROP NOT NULL;
ALTER TABLE guest_feedback ALTER COLUMN reservation_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_guest_feedback_status'
    ) THEN
        ALTER TABLE guest_feedback ADD CONSTRAINT chk_guest_feedback_status CHECK (feedback_status IN (
            'new', 'acknowledged', 'in_progress', 'responded', 'resolved', 'closed'
        ));
    END IF;
END $$;

-- Add comments
COMMENT ON TABLE guest_feedback IS 'Guest reviews, ratings, and feedback after their stay';
COMMENT ON COLUMN guest_feedback.feedback_source IS 'Source of feedback: EMAIL_SURVEY, SMS_SURVEY, IN_APP, GOOGLE, TRIPADVISOR, etc.';
COMMENT ON COLUMN guest_feedback.sentiment_score IS 'AI-calculated sentiment score from -1.00 (negative) to 1.00 (positive)';
COMMENT ON COLUMN guest_feedback.tags IS 'Array of extracted topics/tags from review';
COMMENT ON COLUMN guest_feedback.is_featured IS 'Mark as featured review for marketing';
COMMENT ON COLUMN guest_feedback.feedback_status IS 'Complaint-handling state: new, acknowledged, in_progress, responded, resolved, closed';
COMMENT ON COLUMN guest_feedback.feedback_category IS 'Triage bucket used to group complaints for trend reporting';
COMMENT ON COLUMN guest_feedback.assigned_to IS 'User who owns getting this piece of feedback to a resolution';
COMMENT ON COLUMN guest_feedback.resolution_notes IS 'What was done about the feedback when it was closed';
COMMENT ON COLUMN guest_feedback.service_recovery_reference IS 'Comp posting or goodwill gesture recorded against the complaint that caused it';
COMMENT ON COLUMN guest_feedback.guest_id IS 'Nullable: staff-entered feedback may predate a guest record';
COMMENT ON COLUMN guest_feedback.reservation_id IS 'Nullable: feedback is not always attributable to a single stay';

\echo 'guest_feedback table created successfully!'
