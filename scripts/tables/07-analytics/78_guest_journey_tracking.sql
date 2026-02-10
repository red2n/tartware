-- =====================================================
-- guest_journey_tracking.sql
-- Guest Journey Tracking Table
-- Industry Standard: Guest experience analytics & journey mapping
-- Pattern: Track complete guest journey and touchpoints across all channels
-- Date: 2025-10-17
-- =====================================================
-- Purpose: Track complete guest journey and touchpoints
-- Key Features:
--   - Journey mapping
--   - Touchpoint tracking
--   - Experience analytics
--   - Personalization insights
-- =====================================================

-- =====================================================
-- GUEST_JOURNEY_TRACKING TABLE
-- Tracks complete guest journey from discovery to post-stay
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_journey_tracking (
    -- Primary Key
    journey_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Guest Identification
    guest_id UUID NOT NULL,
    guest_segment VARCHAR(100),

    -- Journey Classification
    journey_type VARCHAR(100) CHECK (journey_type IN (
        'discovery', 'booking', 'pre_arrival', 'arrival', 'stay',
        'departure', 'post_stay', 'complete_cycle'
    )),

    -- Journey Status
    journey_status VARCHAR(50) CHECK (journey_status IN (
        'started', 'in_progress', 'completed', 'abandoned'
    )),

    -- Journey Timeline
    journey_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    journey_end_date TIMESTAMP WITH TIME ZONE,
    journey_duration_minutes INTEGER,

    -- Touchpoint Tracking
    touchpoint_count INTEGER DEFAULT 0,
    touchpoints JSONB, -- [{type, channel, timestamp, action, outcome}]

    -- Channel Analytics
    channels_used VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[],
    primary_channel VARCHAR(100),

    -- Stages Completed
    stages_completed VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[],
    current_stage VARCHAR(100),

    -- Conversion
    converted BOOLEAN DEFAULT FALSE,
    conversion_date TIMESTAMP WITH TIME ZONE,
    conversion_value DECIMAL(12,2),

    -- Engagement Metrics
    total_interactions INTEGER DEFAULT 0,
    website_visits INTEGER DEFAULT 0,
    email_opens INTEGER DEFAULT 0,
    email_clicks INTEGER DEFAULT 0,
    app_sessions INTEGER DEFAULT 0,
    phone_calls INTEGER DEFAULT 0,
    in_person_visits INTEGER DEFAULT 0,

    engagement_score DECIMAL(5,2),

    -- Satisfaction
    satisfaction_score DECIMAL(5,2),
    nps_score INTEGER,
    sentiment VARCHAR(50),

    -- Metadata
    metadata JSONB,
    notes TEXT,
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


COMMENT ON TABLE guest_journey_tracking IS 'Tracks complete guest journey with touchpoints and experience analytics';

COMMENT ON COLUMN guest_journey_tracking.journey_id IS 'Unique identifier for the guest journey record';
COMMENT ON COLUMN guest_journey_tracking.tenant_id IS 'Tenant owning this journey record';
COMMENT ON COLUMN guest_journey_tracking.property_id IS 'Property associated with the journey';
COMMENT ON COLUMN guest_journey_tracking.guest_id IS 'Guest whose journey is being tracked';
COMMENT ON COLUMN guest_journey_tracking.guest_segment IS 'Marketing segment classification of the guest (e.g. VIP, corporate)';
COMMENT ON COLUMN guest_journey_tracking.journey_type IS 'Phase of the guest lifecycle: discovery through post-stay';
COMMENT ON COLUMN guest_journey_tracking.journey_status IS 'Current status: started, in_progress, completed, or abandoned';
COMMENT ON COLUMN guest_journey_tracking.journey_start_date IS 'When the guest journey began';
COMMENT ON COLUMN guest_journey_tracking.journey_end_date IS 'When the guest journey concluded';
COMMENT ON COLUMN guest_journey_tracking.journey_duration_minutes IS 'Total elapsed minutes of the journey';
COMMENT ON COLUMN guest_journey_tracking.touchpoint_count IS 'Number of recorded touchpoints in the journey';
COMMENT ON COLUMN guest_journey_tracking.touchpoints IS 'Detailed touchpoint data: type, channel, timestamp, action, outcome';
COMMENT ON COLUMN guest_journey_tracking.channels_used IS 'Array of all communication channels the guest interacted through';
COMMENT ON COLUMN guest_journey_tracking.primary_channel IS 'Dominant channel used by the guest during the journey';
COMMENT ON COLUMN guest_journey_tracking.stages_completed IS 'Array of journey stages the guest has passed through';
COMMENT ON COLUMN guest_journey_tracking.current_stage IS 'The stage the guest is currently in';
COMMENT ON COLUMN guest_journey_tracking.converted IS 'Whether the journey resulted in a booking conversion';
COMMENT ON COLUMN guest_journey_tracking.conversion_date IS 'Timestamp when the guest converted to a booking';
COMMENT ON COLUMN guest_journey_tracking.conversion_value IS 'Monetary value of the booking resulting from conversion';
COMMENT ON COLUMN guest_journey_tracking.total_interactions IS 'Aggregate count of all guest interactions across channels';
COMMENT ON COLUMN guest_journey_tracking.website_visits IS 'Number of website visits during the journey';
COMMENT ON COLUMN guest_journey_tracking.email_opens IS 'Number of marketing emails opened';
COMMENT ON COLUMN guest_journey_tracking.email_clicks IS 'Number of clicks within marketing emails';
COMMENT ON COLUMN guest_journey_tracking.app_sessions IS 'Number of mobile app sessions during the journey';
COMMENT ON COLUMN guest_journey_tracking.phone_calls IS 'Number of phone calls made during the journey';
COMMENT ON COLUMN guest_journey_tracking.in_person_visits IS 'Number of in-person property visits during the journey';
COMMENT ON COLUMN guest_journey_tracking.engagement_score IS 'Computed engagement score based on interaction metrics';
COMMENT ON COLUMN guest_journey_tracking.satisfaction_score IS 'Guest satisfaction rating collected via surveys';
COMMENT ON COLUMN guest_journey_tracking.nps_score IS 'Net Promoter Score from post-stay survey';
COMMENT ON COLUMN guest_journey_tracking.sentiment IS 'Overall sentiment analysis result for the journey';
COMMENT ON COLUMN guest_journey_tracking.notes IS 'Free-text notes about the guest journey';
COMMENT ON COLUMN guest_journey_tracking.tags IS 'Categorization tags for filtering and segmentation';

\echo 'guest_journey_tracking table created successfully!'
