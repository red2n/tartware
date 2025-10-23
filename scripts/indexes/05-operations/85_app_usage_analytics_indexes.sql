-- =====================================================
-- 85_app_usage_analytics_indexes.sql
-- App Usage Analytics Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating app_usage_analytics indexes...'

CREATE INDEX idx_app_usage_analytics_tenant ON app_usage_analytics(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_property ON app_usage_analytics(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_guest ON app_usage_analytics(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_session ON app_usage_analytics(session_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_event_type ON app_usage_analytics(event_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_app_usage_analytics_timestamp ON app_usage_analytics(event_timestamp DESC) WHERE is_deleted = FALSE;

\echo 'App Usage Analytics indexes created successfully!'
