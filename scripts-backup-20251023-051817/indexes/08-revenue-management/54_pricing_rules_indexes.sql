-- =====================================================
-- 54_pricing_rules_indexes.sql
-- Pricing Rules Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating pricing_rules indexes...'

CREATE INDEX idx_pricing_rules_tenant ON pricing_rules(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_property ON pricing_rules(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_code ON pricing_rules(rule_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_category ON pricing_rules(rule_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active, is_paused) WHERE is_active = TRUE AND is_paused = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_effective ON pricing_rules(effective_from, effective_until) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_approval ON pricing_rules(approval_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_ab_test ON pricing_rules(is_ab_test, ab_test_variant) WHERE is_ab_test = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_performance ON pricing_rules(times_applied, effectiveness_score) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_last_applied ON pricing_rules(last_applied_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_room_types ON pricing_rules USING gin(applies_to_room_types) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_channels ON pricing_rules USING gin(applies_to_channels) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_conditions ON pricing_rules USING gin(conditions) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_metadata ON pricing_rules USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_tags ON pricing_rules USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_pricing_rules_property_active_priority ON pricing_rules(property_id, is_active, priority) WHERE is_paused = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_property_type ON pricing_rules(property_id, rule_type, is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_pricing_rules_active_effective ON pricing_rules(is_active, effective_from, effective_until, priority) WHERE is_paused = FALSE AND is_deleted = FALSE;

\echo 'Pricing Rules indexes created successfully!'
