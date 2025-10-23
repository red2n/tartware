-- =====================================================
-- 87_api_logs_indexes.sql
-- Api Logs Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating api_logs indexes...'

CREATE INDEX idx_api_logs_tenant ON api_logs(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_property ON api_logs(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_endpoint ON api_logs(endpoint) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_method ON api_logs(http_method) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_timestamp ON api_logs(request_timestamp DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_status ON api_logs(status_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_success ON api_logs(success) WHERE success = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_api_logs_user ON api_logs(user_id) WHERE user_id IS NOT NULL AND is_deleted = FALSE;

\echo 'Api Logs indexes created successfully!'
