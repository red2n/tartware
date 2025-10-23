-- =====================================================
-- 50_automated_messages_indexes.sql
-- Automated Messages Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating automated_messages indexes...'

CREATE INDEX idx_automated_messages_tenant ON automated_messages(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_property ON automated_messages(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_code ON automated_messages(message_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_trigger ON automated_messages(trigger_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_active ON automated_messages(is_active, is_paused) WHERE is_active = TRUE AND is_paused = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_priority ON automated_messages(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_template ON automated_messages(template_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_channel ON automated_messages(message_channel) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_last_sent ON automated_messages(last_sent_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_ab_test ON automated_messages(is_ab_test, ab_test_variant) WHERE is_ab_test = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_performance ON automated_messages(sent_count, open_rate, click_rate) WHERE sent_count > 0 AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_conditions ON automated_messages USING gin(conditions) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_metadata ON automated_messages USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_tags ON automated_messages USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_property_active ON automated_messages(property_id, is_active, trigger_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_automated_messages_trigger_active ON automated_messages(trigger_type, is_active, priority) WHERE is_active = TRUE AND is_paused = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_automated_messages_tenant_channel ON automated_messages(tenant_id, message_channel, is_active) WHERE is_deleted = FALSE;

\echo 'Automated Messages indexes created successfully!'
