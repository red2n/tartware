-- =====================================================
-- 69_marketing_campaigns_indexes.sql
-- Marketing Campaigns Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating marketing_campaigns indexes...'

CREATE INDEX idx_marketing_campaigns_tenant ON marketing_campaigns(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_property ON marketing_campaigns(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_code ON marketing_campaigns(campaign_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_type ON marketing_campaigns(campaign_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(campaign_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_active ON marketing_campaigns(campaign_status) WHERE campaign_status = 'active' AND is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_dates ON marketing_campaigns(start_date, end_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_manager ON marketing_campaigns(campaign_manager_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_channels ON marketing_campaigns USING gin(channels) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_roi ON marketing_campaigns(roi_percent DESC) WHERE campaign_status = 'completed' AND is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_approval ON marketing_campaigns(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_metadata ON marketing_campaigns USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_tags ON marketing_campaigns USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_property_active ON marketing_campaigns(property_id, campaign_status, start_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_marketing_campaigns_property_type ON marketing_campaigns(property_id, campaign_type, campaign_status) WHERE is_deleted = FALSE;

\echo 'Marketing Campaigns indexes created successfully!'
