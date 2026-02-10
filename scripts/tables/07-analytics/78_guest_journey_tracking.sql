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

\echo 'guest_journey_tracking table created successfully!'

\echo 'guest_journey_tracking table created successfully!'

\echo 'guest_journey_tracking table created successfully!'
