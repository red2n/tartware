-- =====================================================
-- 45_channel_rate_parity_indexes.sql
-- Channel Rate Parity Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating channel_rate_parity indexes...'

CREATE INDEX idx_channel_rate_parity_tenant ON channel_rate_parity(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_property ON channel_rate_parity(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_room_type ON channel_rate_parity(room_type_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_rate_plan ON channel_rate_parity(rate_plan_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_check_date ON channel_rate_parity(check_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_status ON channel_rate_parity(parity_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_violations ON channel_rate_parity(violations_detected) WHERE violations_detected > 0 AND is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_unresolved ON channel_rate_parity(is_resolved) WHERE is_resolved = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_alert ON channel_rate_parity(alert_sent, alert_sent_at) WHERE alert_sent = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_check_initiated ON channel_rate_parity(check_initiated_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_check_completed ON channel_rate_parity(check_completed_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_recurring ON channel_rate_parity(is_recurring_violation, consecutive_violations) WHERE is_recurring_violation = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_market_position ON channel_rate_parity(market_position) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_contract_risk ON channel_rate_parity(contract_violation_risk) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_channel_rates ON channel_rate_parity USING gin(channel_rates) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_violation_details ON channel_rate_parity USING gin(violation_details) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_competitor_rates ON channel_rate_parity USING gin(competitor_rates) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_metadata ON channel_rate_parity USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_tags ON channel_rate_parity USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_channel_rate_parity_property_date ON channel_rate_parity(property_id, check_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_room_date ON channel_rate_parity(room_type_id, check_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_property_status ON channel_rate_parity(property_id, parity_status, check_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_channel_rate_parity_tenant_unresolved ON channel_rate_parity(tenant_id, is_resolved, check_date DESC) WHERE is_resolved = FALSE AND is_deleted = FALSE;

\echo 'Channel Rate Parity indexes created successfully!'
