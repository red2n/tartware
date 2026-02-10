-- =====================================================
-- Social Media Mentions Table
-- =====================================================
-- Purpose: Track social media mentions and engagement
-- Key Features:
--   - Multi-platform monitoring
--   - Sentiment analysis
--   - Engagement tracking
--   - Response management
-- =====================================================

CREATE TABLE IF NOT EXISTS social_media_mentions (
    -- Primary Key
    mention_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Platform
    platform VARCHAR(100) NOT NULL CHECK (platform IN (
        'facebook', 'twitter', 'instagram', 'linkedin', 'youtube',
        'tiktok', 'pinterest', 'tripadvisor', 'google', 'yelp', 'other'
    )),

    -- Mention Details
    post_id VARCHAR(255) UNIQUE,
    post_url TEXT,
    post_type VARCHAR(50) CHECK (post_type IN (
        'post', 'comment', 'review', 'story', 'video',
        'photo', 'reel', 'tweet', 'share', 'mention', 'tag'
    )),

    -- Author
    author_username VARCHAR(255),
    author_display_name VARCHAR(255),
    author_profile_url TEXT,
    author_follower_count INTEGER,
    author_verified BOOLEAN DEFAULT FALSE,

    -- Guest Association
    guest_id UUID,
    reservation_id UUID,

    -- Content
    content_text TEXT,
    content_language VARCHAR(10),

    has_media BOOLEAN DEFAULT FALSE,
    media_urls TEXT[],
    media_type VARCHAR(50), -- photo, video, carousel

    hashtags VARCHAR(100)[],
    mentioned_accounts VARCHAR(255)[],

    -- Dates
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Engagement Metrics
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,

    engagement_rate DECIMAL(5,2),
    reach INTEGER,
    impressions INTEGER,

    -- Sentiment Analysis
    sentiment VARCHAR(50) CHECK (sentiment IN (
        'very_positive', 'positive', 'neutral', 'negative', 'very_negative', 'mixed'
    )),
    sentiment_score DECIMAL(5,2), -- -1.0 to 1.0
    sentiment_confidence DECIMAL(5,2),

    -- Classification
    mention_category VARCHAR(100) CHECK (mention_category IN (
        'review', 'complaint', 'praise', 'question', 'feedback',
        'recommendation', 'checkin', 'user_generated_content', 'other'
    )),

    topics VARCHAR(100)[],
    keywords VARCHAR(100)[],

    -- Priority
    priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    requires_response BOOLEAN DEFAULT FALSE,
    response_deadline TIMESTAMP WITH TIME ZONE,

    -- Response Management
    responded BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by UUID,
    response_time_minutes INTEGER,

    -- Status
    mention_status VARCHAR(50) DEFAULT 'new' CHECK (mention_status IN (
        'new', 'reviewed', 'responded', 'escalated',
        'resolved', 'ignored', 'archived'
    )),

    -- Assignment
    assigned_to UUID,
    assigned_at TIMESTAMP WITH TIME ZONE,

    -- Escalation
    escalated BOOLEAN DEFAULT FALSE,
    escalated_to UUID,
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalation_reason TEXT,

    -- Flag/Alert
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,

    is_crisis BOOLEAN DEFAULT FALSE,
    crisis_level VARCHAR(50),

    -- Verification
    verified_genuine BOOLEAN,
    verified_by UUID,
    verification_notes TEXT,

    -- Spam/Fake Detection
    is_spam BOOLEAN DEFAULT FALSE,
    is_bot BOOLEAN DEFAULT FALSE,
    spam_score DECIMAL(5,2),

    -- Influence Score
    influencer_tier VARCHAR(50) CHECK (influencer_tier IN (
        'nano', 'micro', 'mid', 'macro', 'mega', 'celebrity'
    )),
    influence_score INTEGER,

    -- Campaign Association
    campaign_id UUID,
    related_to_promotion BOOLEAN DEFAULT FALSE,
    promo_code_mentioned VARCHAR(100),

    -- Competitor Mention
    mentions_competitor BOOLEAN DEFAULT FALSE,
    competitor_names VARCHAR(255)[],

    -- Legal/Compliance
    contains_personal_info BOOLEAN DEFAULT FALSE,
    contains_inappropriate_content BOOLEAN DEFAULT FALSE,
    copyright_concern BOOLEAN DEFAULT FALSE,

    requires_legal_review BOOLEAN DEFAULT FALSE,
    legal_reviewed BOOLEAN DEFAULT FALSE,

    -- Conversion Tracking
    led_to_booking BOOLEAN DEFAULT FALSE,
    booking_id UUID,
    conversion_value DECIMAL(10,2),

    -- Analytics
    geo_location VARCHAR(255),
    device_type VARCHAR(50),

    -- Related Mentions
    parent_mention_id UUID,
    thread_id VARCHAR(255),
    is_reply BOOLEAN DEFAULT FALSE,

    -- Export/Reporting
    included_in_reports BOOLEAN DEFAULT FALSE,
    report_ids UUID[],

    screenshot_url TEXT,

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


COMMENT ON TABLE social_media_mentions IS 'Tracks social media mentions with sentiment analysis and response management';
COMMENT ON COLUMN social_media_mentions.mention_id IS 'Unique identifier for the social media mention';
COMMENT ON COLUMN social_media_mentions.tenant_id IS 'Tenant owning this mention record';
COMMENT ON COLUMN social_media_mentions.platform IS 'Social media platform where the mention was posted';
COMMENT ON COLUMN social_media_mentions.post_id IS 'Unique post identifier from the originating platform';
COMMENT ON COLUMN social_media_mentions.post_url IS 'Direct URL to the original post on the platform';
COMMENT ON COLUMN social_media_mentions.post_type IS 'Content format of the post (post, comment, review, story, reel, etc.)';
COMMENT ON COLUMN social_media_mentions.author_username IS 'Username of the person who created the post';
COMMENT ON COLUMN social_media_mentions.author_follower_count IS 'Number of followers the author has on the platform';
COMMENT ON COLUMN social_media_mentions.author_verified IS 'Whether the author has a verified/blue-check account';
COMMENT ON COLUMN social_media_mentions.guest_id IS 'Associated guest profile if the author is an identified guest';
COMMENT ON COLUMN social_media_mentions.reservation_id IS 'Associated reservation if the mention relates to a specific stay';
COMMENT ON COLUMN social_media_mentions.content_text IS 'Full text content of the post or mention';
COMMENT ON COLUMN social_media_mentions.posted_at IS 'Timestamp when the post was originally published on the platform';
COMMENT ON COLUMN social_media_mentions.detected_at IS 'Timestamp when the system first detected this mention';
COMMENT ON COLUMN social_media_mentions.likes_count IS 'Number of likes or reactions on the post';
COMMENT ON COLUMN social_media_mentions.comments_count IS 'Number of comments on the post';
COMMENT ON COLUMN social_media_mentions.shares_count IS 'Number of times the post was shared or retweeted';
COMMENT ON COLUMN social_media_mentions.engagement_rate IS 'Calculated engagement rate as a percentage of reach';
COMMENT ON COLUMN social_media_mentions.reach IS 'Number of unique users who saw the post';
COMMENT ON COLUMN social_media_mentions.sentiment IS 'Overall sentiment classification of the mention';
COMMENT ON COLUMN social_media_mentions.sentiment_score IS 'Numeric sentiment score from -1.0 (negative) to 1.0 (positive)';
COMMENT ON COLUMN social_media_mentions.mention_category IS 'Business category of the mention (review, complaint, praise, etc.)';
COMMENT ON COLUMN social_media_mentions.priority IS 'Response priority level (low, medium, high, urgent)';
COMMENT ON COLUMN social_media_mentions.requires_response IS 'Whether this mention requires a staff response';
COMMENT ON COLUMN social_media_mentions.responded IS 'Whether staff have responded to the mention';
COMMENT ON COLUMN social_media_mentions.response_time_minutes IS 'Minutes between detection and first response';
COMMENT ON COLUMN social_media_mentions.mention_status IS 'Workflow status of the mention (new, reviewed, responded, escalated, etc.)';
COMMENT ON COLUMN social_media_mentions.assigned_to IS 'Staff member assigned to handle this mention';
COMMENT ON COLUMN social_media_mentions.escalated IS 'Whether the mention has been escalated to management';
COMMENT ON COLUMN social_media_mentions.is_crisis IS 'Whether this mention is part of a PR crisis event';
COMMENT ON COLUMN social_media_mentions.influencer_tier IS 'Influencer classification by follower count (nano through celebrity)';
COMMENT ON COLUMN social_media_mentions.influence_score IS 'Numeric influence score for prioritizing responses';
COMMENT ON COLUMN social_media_mentions.led_to_booking IS 'Whether this mention resulted in a booking conversion';
COMMENT ON COLUMN social_media_mentions.conversion_value IS 'Monetary value of any booking attributed to this mention';

\echo 'social_media_mentions table created successfully!'
