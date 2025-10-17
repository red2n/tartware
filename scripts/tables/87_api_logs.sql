-- =====================================================
-- API Logs Table
-- =====================================================

CREATE TABLE IF NOT EXISTS api_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    api_name VARCHAR(255),
    endpoint VARCHAR(500) NOT NULL,
    http_method VARCHAR(10) CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),

    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_timestamp TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,

    status_code INTEGER,
    status_message VARCHAR(255),

    request_headers JSONB,
    request_body JSONB,
    response_headers JSONB,
    response_body JSONB,

    success BOOLEAN,
    error_message TEXT,

    ip_address VARCHAR(45),
    user_agent TEXT,

    user_id UUID,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_api_logs_tenant ON api_logs(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_property ON api_logs(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_endpoint ON api_logs(endpoint) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_method ON api_logs(http_method) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_timestamp ON api_logs(request_timestamp DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_status ON api_logs(status_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_api_logs_success ON api_logs(success) WHERE success = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_api_logs_user ON api_logs(user_id) WHERE user_id IS NOT NULL AND is_deleted = FALSE;

COMMENT ON TABLE api_logs IS 'Logs all API requests and responses for monitoring and debugging';
