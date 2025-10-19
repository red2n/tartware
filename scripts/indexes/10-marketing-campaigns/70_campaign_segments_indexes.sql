-- =====================================================
-- 70_campaign_segments_indexes.sql
-- Campaign Segments Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating campaign_segments indexes...'

CREATE INDEX idx_campaign_segments_tenant ON campaign_segments(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_property ON campaign_segments(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_code ON campaign_segments(segment_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_type ON campaign_segments(segment_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_active ON campaign_segments(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_owner ON campaign_segments(owner_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_refresh ON campaign_segments(auto_refresh, next_refresh_at) WHERE auto_refresh = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_criteria ON campaign_segments USING gin(criteria_definition) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_metadata ON campaign_segments USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_tags ON campaign_segments USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_campaign_segments_property_active ON campaign_segments(property_id, is_active, segment_type) WHERE is_deleted = FALSE;

\echo 'Campaign Segments indexes created successfully!'
