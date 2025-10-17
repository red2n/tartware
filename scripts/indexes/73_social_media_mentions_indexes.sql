-- =====================================================
-- 73_social_media_mentions_indexes.sql
-- Social Media Mentions Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating social_media_mentions indexes...'

CREATE INDEX idx_social_media_mentions_tenant ON social_media_mentions(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_property ON social_media_mentions(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_platform ON social_media_mentions(platform) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_post_id ON social_media_mentions(post_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_guest ON social_media_mentions(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_reservation ON social_media_mentions(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_posted_at ON social_media_mentions(posted_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_sentiment ON social_media_mentions(sentiment) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_category ON social_media_mentions(mention_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_status ON social_media_mentions(mention_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_priority ON social_media_mentions(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_requires_response ON social_media_mentions(requires_response, responded) WHERE requires_response = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_assigned ON social_media_mentions(assigned_to, mention_status) WHERE assigned_to IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_escalated ON social_media_mentions(escalated) WHERE escalated = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_flagged ON social_media_mentions(flagged) WHERE flagged = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_crisis ON social_media_mentions(is_crisis) WHERE is_crisis = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_campaign ON social_media_mentions(campaign_id) WHERE campaign_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_influencer ON social_media_mentions(influencer_tier, influence_score DESC) WHERE influencer_tier IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_parent ON social_media_mentions(parent_mention_id) WHERE parent_mention_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_hashtags ON social_media_mentions USING gin(hashtags) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_metadata ON social_media_mentions USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_tags ON social_media_mentions USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_property_unresponded ON social_media_mentions(property_id, requires_response, responded, priority) WHERE requires_response = TRUE AND responded = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_property_sentiment ON social_media_mentions(property_id, sentiment, posted_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_media_mentions_platform_sentiment ON social_media_mentions(platform, sentiment, posted_at DESC) WHERE is_deleted = FALSE;

\echo 'Social Media Mentions indexes created successfully!'
