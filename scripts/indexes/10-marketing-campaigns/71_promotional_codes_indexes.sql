-- =====================================================
-- 71_promotional_codes_indexes.sql
-- Promotional Codes Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating promotional_codes indexes...'

CREATE INDEX idx_promotional_codes_tenant ON promotional_codes(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_property ON promotional_codes(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_code ON promotional_codes(promo_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_status ON promotional_codes(promo_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_active ON promotional_codes(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_valid ON promotional_codes(valid_from, valid_to) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_current ON promotional_codes(valid_from, valid_to) WHERE valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE AND is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_campaign ON promotional_codes(campaign_id) WHERE campaign_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_usage ON promotional_codes(has_usage_limit, remaining_uses) WHERE has_usage_limit = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_owner ON promotional_codes(owner_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_metadata ON promotional_codes USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_tags ON promotional_codes USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_property_active ON promotional_codes(property_id, is_active, valid_to) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotional_codes_performance ON promotional_codes(property_id, times_redeemed DESC, total_revenue_generated DESC) WHERE is_deleted = FALSE;

\echo 'Promotional Codes indexes created successfully!'
