-- =====================================================
-- Guest Journey Tracking Table
-- =====================================================
-- Purpose: Track complete guest journey and touchpoints
-- Key Features:
--   - Journey mapping
--   - Touchpoint tracking
--   - Experience analytics
--   - Personalization insights
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_journey_tracking (
    -- Primary Key
    journey_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Guest
    guest_id UUID NOT NULL,
    guest_segment VARCHAR(100),

    -- Journey Details
    journey_type VARCHAR(100) CHECK (journey_type IN (
        'discovery', 'booking', 'pre_arrival', 'arrival', 'stay',
        'departure', 'post_stay', 'complete_cycle'
    )),

    journey_status VARCHAR(50) CHECK (journey_status IN (
        'started', 'in_progress', 'completed', 'abandoned'
    )),

    journey_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    journey_end_date TIMESTAMP WITH TIME ZONE,
    journey_duration_minutes INTEGER,

    -- Touchpoints
    touchpoint_count INTEGER DEFAULT 0,
    touchpoints JSONB, -- [{type, channel, timestamp, action, outcome}]

    -- Channels Used
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

CREATE INDEX idx_guest_journey_tracking_tenant ON guest_journey_tracking(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_property ON guest_journey_tracking(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_guest ON guest_journey_tracking(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_type ON guest_journey_tracking(journey_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_status ON guest_journey_tracking(journey_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_converted ON guest_journey_tracking(converted) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_touchpoints ON guest_journey_tracking USING gin(touchpoints) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_metadata ON guest_journey_tracking USING gin(metadata) WHERE is_deleted = FALSE;

COMMENT ON TABLE guest_journey_tracking IS 'Tracks complete guest journey with touchpoints and experience analytics';
