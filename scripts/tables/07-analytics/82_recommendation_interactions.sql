-- =====================================================
-- 82_recommendation_interactions.sql
-- Recommendation Interaction Tracking Table
-- Industry Standard: ML feedback loop — implicit signals
--   from recommendation→view→book→review for model training
-- Pattern: Event sourcing for recommendation quality metrics
-- Date: 2026-04-04
-- =====================================================

-- =====================================================
-- RECOMMENDATION_INTERACTIONS TABLE
-- Tracks every recommendation shown, clicked, booked,
-- and post-stay rated — the closed feedback loop that
-- turns a rule-based ranker into a true recommendation
-- engine.
-- =====================================================

CREATE TABLE IF NOT EXISTS recommendation_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),       -- Unique interaction record
    tenant_id UUID NOT NULL,                                          -- Multi-tenancy discriminator
    property_id UUID NOT NULL,                                        -- Property where recommendation was made

    -- Recommendation context
    recommendation_request_id UUID NOT NULL,                          -- Pipeline requestId for tracing
    guest_id UUID,                                                    -- Guest who received the recommendation (NULL = anonymous)
    room_id UUID NOT NULL,                                            -- Room that was recommended
    room_type_id UUID NOT NULL,                                       -- Room type for aggregate analytics

    -- What happened
    interaction_type VARCHAR(20) NOT NULL DEFAULT 'shown',            -- shown | viewed | selected | booked | rejected | dismissed
    position_shown SMALLINT NOT NULL,                                 -- Rank position (1-based) when shown
    relevance_score_at_time DECIMAL(5,4),                             -- Pipeline score when shown (0.0000-1.0000)

    -- Conversion tracking
    booked BOOLEAN DEFAULT false,                                     -- Did this recommendation convert to a booking?
    reservation_id UUID,                                              -- Linked reservation if booked
    booking_delay_minutes INTEGER,                                    -- Minutes between shown and booked (NULL if not booked)

    -- Post-stay feedback link
    post_stay_rating DECIMAL(3,2),                                    -- Overall rating from guest_feedback (joined async)
    post_stay_would_return BOOLEAN,                                   -- Would the guest rebook this room?
    feedback_id UUID,                                                 -- FK to guest_feedback.id

    -- Pipeline metadata
    pipeline_execution_ms DECIMAL(10,2),                              -- Pipeline execution time when generated
    scoring_breakdown JSONB,                                          -- Individual scorer contributions { preference: 0.8, value: 0.6, ... }
    source VARCHAR(30),                                               -- available_rooms | similar_rooms | upgrade_opportunity

    -- Session context
    session_id UUID,                                                  -- Browser/app session for grouping
    device_type VARCHAR(20),                                          -- desktop | mobile | tablet | api
    channel VARCHAR(30),                                              -- pms_ui | guest_portal | api | ota

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,    -- When the interaction was recorded
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,    -- Last update (e.g., booked=true backfill)

    -- Constraints
    CONSTRAINT chk_interaction_type CHECK (interaction_type IN ('shown', 'viewed', 'selected', 'booked', 'rejected', 'dismissed')),
    CONSTRAINT chk_position_shown CHECK (position_shown >= 1 AND position_shown <= 200),
    CONSTRAINT chk_relevance_score CHECK (relevance_score_at_time >= 0 AND relevance_score_at_time <= 1),
    CONSTRAINT chk_post_stay_rating CHECK (post_stay_rating IS NULL OR (post_stay_rating >= 0 AND post_stay_rating <= 5)),
    CONSTRAINT chk_device_type CHECK (device_type IS NULL OR device_type IN ('desktop', 'mobile', 'tablet', 'api')),
    CONSTRAINT chk_channel CHECK (channel IS NULL OR channel IN ('pms_ui', 'guest_portal', 'api', 'ota'))
);

-- Indexes for query patterns used by the recommendation engine
CREATE INDEX IF NOT EXISTS idx_rec_interactions_tenant_property
    ON recommendation_interactions (tenant_id, property_id);

CREATE INDEX IF NOT EXISTS idx_rec_interactions_request
    ON recommendation_interactions (recommendation_request_id);

CREATE INDEX IF NOT EXISTS idx_rec_interactions_guest
    ON recommendation_interactions (guest_id)
    WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rec_interactions_room_type
    ON recommendation_interactions (tenant_id, room_type_id, booked);

CREATE INDEX IF NOT EXISTS idx_rec_interactions_conversion
    ON recommendation_interactions (tenant_id, property_id, booked, created_at)
    WHERE booked = true;

CREATE INDEX IF NOT EXISTS idx_rec_interactions_feedback
    ON recommendation_interactions (feedback_id)
    WHERE feedback_id IS NOT NULL;

-- Index for recent interactions (scoring hot path — prune with scheduled maintenance)
CREATE INDEX IF NOT EXISTS idx_rec_interactions_recent
    ON recommendation_interactions (tenant_id, room_type_id, created_at DESC);

-- Catalog comments
COMMENT ON TABLE recommendation_interactions IS 'Closed-loop tracking of recommendation→view→book→review for ML feedback';
COMMENT ON COLUMN recommendation_interactions.recommendation_request_id IS 'Pipeline requestId — links all recommendations from one execution';
COMMENT ON COLUMN recommendation_interactions.position_shown IS '1-based rank position when recommendation was displayed';
COMMENT ON COLUMN recommendation_interactions.relevance_score_at_time IS 'Pipeline relevance score (0-1) at time of recommendation';
COMMENT ON COLUMN recommendation_interactions.scoring_breakdown IS 'Per-scorer contributions: { preference: 0.8, value: 0.6, feedback: 0.9 }';
COMMENT ON COLUMN recommendation_interactions.booking_delay_minutes IS 'Time between recommendation shown and booking — measures decision latency';
COMMENT ON COLUMN recommendation_interactions.post_stay_rating IS 'Post-stay overall rating backfilled from guest_feedback after checkout';

\echo 'recommendation_interactions table created successfully!'
