-- =====================================================
-- 46_channel_commission_rules_indexes.sql
-- Channel Commission Rules Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating channel_commission_rules indexes...'

CREATE INDEX idx_channel_commission_rules_tenant ON channel_commission_rules(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_property ON channel_commission_rules(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_channel ON channel_commission_rules(channel_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_ota_config ON channel_commission_rules(ota_config_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_rule_code ON channel_commission_rules(rule_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_active ON channel_commission_rules(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_effective ON channel_commission_rules(effective_from, effective_until) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_type ON channel_commission_rules(rule_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_model ON channel_commission_rules(commission_model) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_priority ON channel_commission_rules(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_contract ON channel_commission_rules(contract_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_review ON channel_commission_rules(next_review_date) WHERE next_review_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_room_types ON channel_commission_rules USING gin(applies_to_room_types) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_rate_plans ON channel_commission_rules USING gin(applies_to_rate_plans) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_tier_structure ON channel_commission_rules USING gin(tier_structure) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_metadata ON channel_commission_rules USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_tags ON channel_commission_rules USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_channel_commission_rules_property_channel ON channel_commission_rules(property_id, channel_name, is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_tenant_active ON channel_commission_rules(tenant_id, is_active, priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_commission_rules_date_active ON channel_commission_rules(effective_from, effective_until, is_active) WHERE is_active = TRUE AND is_deleted = FALSE;

\echo 'Channel Commission Rules indexes created successfully!'
