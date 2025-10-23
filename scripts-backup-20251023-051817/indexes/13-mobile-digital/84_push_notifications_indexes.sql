-- =====================================================
-- 84_push_notifications_indexes.sql
-- Push Notifications Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating push_notifications indexes...'

CREATE INDEX idx_push_notifications_tenant ON push_notifications(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_property ON push_notifications(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_recipient ON push_notifications(recipient_type, recipient_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_guest ON push_notifications(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_push_notifications_status ON push_notifications(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_push_notifications_scheduled ON push_notifications(scheduled_at) WHERE status = 'scheduled' AND is_deleted = FALSE;

\echo 'Push Notifications indexes created successfully!'
