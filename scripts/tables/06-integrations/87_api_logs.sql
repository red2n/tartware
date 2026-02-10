-- =====================================================
-- api_logs.sql
-- API Logs Table
-- Industry Standard: API request/response logging and monitoring
-- Pattern: Comprehensive API call logging for debugging and analytics
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- API_LOGS TABLE
-- Comprehensive API request/response logging
-- =====================================================

CREATE TABLE IF NOT EXISTS api_logs (
    -- Primary Key
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- API Identification
    api_name VARCHAR(255),
    endpoint VARCHAR(500) NOT NULL,
    http_method VARCHAR(10) CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),

    -- Timing
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


COMMENT ON TABLE api_logs IS 'Logs all API requests and responses for monitoring and debugging';
COMMENT ON COLUMN api_logs.log_id IS 'Unique identifier for the API log entry';
COMMENT ON COLUMN api_logs.tenant_id IS 'Tenant that made the API request';
COMMENT ON COLUMN api_logs.property_id IS 'Property context of the API request';
COMMENT ON COLUMN api_logs.api_name IS 'Logical name of the API or service called';
COMMENT ON COLUMN api_logs.endpoint IS 'Full URL path of the API endpoint invoked';
COMMENT ON COLUMN api_logs.http_method IS 'HTTP method used for the request (GET, POST, PUT, PATCH, DELETE)';
COMMENT ON COLUMN api_logs.request_timestamp IS 'Timestamp when the API request was received';
COMMENT ON COLUMN api_logs.response_timestamp IS 'Timestamp when the API response was sent';
COMMENT ON COLUMN api_logs.duration_ms IS 'Total request-to-response duration in milliseconds';
COMMENT ON COLUMN api_logs.status_code IS 'HTTP status code returned by the API';
COMMENT ON COLUMN api_logs.status_message IS 'Human-readable status message accompanying the status code';
COMMENT ON COLUMN api_logs.request_headers IS 'HTTP headers sent with the request (sensitive values redacted)';
COMMENT ON COLUMN api_logs.request_body IS 'JSON body of the incoming API request';
COMMENT ON COLUMN api_logs.response_body IS 'JSON body of the API response';
COMMENT ON COLUMN api_logs.success IS 'Whether the API call completed successfully';
COMMENT ON COLUMN api_logs.error_message IS 'Error message if the API call failed';
COMMENT ON COLUMN api_logs.ip_address IS 'IP address of the client making the request';
COMMENT ON COLUMN api_logs.user_agent IS 'User-Agent header identifying the client software';
COMMENT ON COLUMN api_logs.user_id IS 'Authenticated user who made the API request';

\echo 'api_logs table created successfully!'
