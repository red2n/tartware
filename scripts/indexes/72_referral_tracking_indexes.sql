-- =====================================================
-- 72_referral_tracking_indexes.sql
-- Referral Tracking Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating referral_tracking indexes...'

CREATE INDEX idx_referral_tracking_tenant ON referral_tracking(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_property ON referral_tracking(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_code ON referral_tracking(referral_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_referrer ON referral_tracking(referrer_type, referrer_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_referee ON referral_tracking(referee_id) WHERE referee_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_status ON referral_tracking(referral_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_converted ON referral_tracking(converted, converted_at) WHERE converted = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_reservation ON referral_tracking(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_campaign ON referral_tracking(campaign_id) WHERE campaign_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_parent ON referral_tracking(parent_referral_id) WHERE parent_referral_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_rewards_issued ON referral_tracking(referrer_reward_issued, referee_reward_issued) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_suspicious ON referral_tracking(flagged_suspicious) WHERE flagged_suspicious = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_approval ON referral_tracking(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_metadata ON referral_tracking USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_tags ON referral_tracking USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_property_status ON referral_tracking(property_id, referral_status, referred_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_referral_tracking_referrer_performance ON referral_tracking(referrer_id, converted, revenue_generated DESC) WHERE is_deleted = FALSE;

\echo 'Referral Tracking indexes created successfully!'
