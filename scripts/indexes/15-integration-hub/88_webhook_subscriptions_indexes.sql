-- =====================================================
-- 88_webhook_subscriptions_indexes.sql
-- Webhook Subscriptions Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating webhook_subscriptions indexes...'

CREATE INDEX idx_webhook_subscriptions_tenant ON webhook_subscriptions(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_webhook_subscriptions_property ON webhook_subscriptions(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_webhook_subscriptions_active ON webhook_subscriptions(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_webhook_subscriptions_events ON webhook_subscriptions USING gin(event_types) WHERE is_deleted = FALSE;

\echo 'Webhook Subscriptions indexes created successfully!'
