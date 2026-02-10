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

\echo 'api_logs table created successfully!'

\echo 'api_logs table created successfully!'

\echo 'api_logs table created successfully!'
