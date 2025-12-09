-- =====================================================
-- 27_audit_logs.sql
-- System Audit Trail
--
-- Purpose: Comprehensive audit logging for compliance
-- Industry Standard: OPERA (ACTIVITY_LOG), Cloudbeds (audit_trail),
--                    Protel (AUDIT), RMS (audit_log)
--
-- Compliance Requirements:
-- - PCI DSS: Track all payment data access
-- - SOC 2: System change tracking
-- - GDPR: Personal data access logs
-- - General: Who did what, when, and why
--
-- Features:
-- - Multi-tenancy support
-- - JSON change tracking (old/new values)
-- - IP address logging
-- - User agent tracking
-- - Never deleted (compliance requirement)
-- =====================================================
-- Compliance Mapping: docs/compliance-mapping.md#sox--platform-audit--access

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
    -- Primary Key
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID, -- May be null for tenant-level actions

    -- Audit Information
    audit_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, ACCESS, LOGIN, LOGOUT, etc.
    entity_type VARCHAR(100) NOT NULL, -- reservations, guests, payments, users, etc.
    entity_id UUID, -- ID of the affected record

    -- User Information
    user_id UUID NOT NULL, -- Who performed the action
    user_email VARCHAR(255),
    user_name VARCHAR(200),
    user_role VARCHAR(50),

    -- Action Details
    action VARCHAR(100) NOT NULL, -- Specific action taken
    action_category VARCHAR(50), -- FINANCIAL, SECURITY, DATA_ACCESS, CONFIGURATION, etc.
    severity VARCHAR(20) DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'SECURITY')),

    -- Change Tracking
    old_values JSONB, -- Previous state of the record
    new_values JSONB, -- New state of the record
    changed_fields TEXT[], -- Array of field names that changed

    -- Request Context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100), -- Correlation ID for tracing
    session_id VARCHAR(100),
    api_endpoint VARCHAR(500), -- API endpoint called
    http_method VARCHAR(10), -- GET, POST, PUT, DELETE

    -- Geographic Information
    country_code CHAR(2),
    city VARCHAR(100),

    -- Compliance Tags
    is_pci_relevant BOOLEAN DEFAULT FALSE, -- Payment card data involved
    is_gdpr_relevant BOOLEAN DEFAULT FALSE, -- Personal data involved
    is_sensitive BOOLEAN DEFAULT FALSE, -- Sensitive operation

    -- Result Information
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILURE', 'PARTIAL')),
    error_message TEXT,
    error_code VARCHAR(50),

    -- Description
    description TEXT, -- Human-readable description
    reason TEXT, -- Reason for the action (especially for deletions/refunds)

    -- Business Context
    business_date DATE, -- Property business date when action occurred

    -- Metadata
    metadata JSONB, -- Additional context-specific data

    -- Performance Tracking
    response_time_ms INTEGER -- How long the operation took

    -- Never soft-deleted for compliance
    -- No deleted_at column - audit logs are permanent

    -- Indexes will be added via indexes file
    -- Foreign Keys (will be added via constraints file)
    -- FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    -- FOREIGN KEY (property_id) REFERENCES properties(property_id),
    -- FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Add table comment
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance (PCI DSS, SOC 2, GDPR) - see docs/compliance-mapping.md#sox--platform-audit--access. Never deleted.';

-- Add column comments
COMMENT ON COLUMN audit_logs.audit_id IS 'Unique identifier for audit entry';
COMMENT ON COLUMN audit_logs.event_type IS 'Type of event: CREATE, UPDATE, DELETE, ACCESS, LOGIN, etc.';
COMMENT ON COLUMN audit_logs.entity_type IS 'Table/resource affected: reservations, guests, payments, etc.';
COMMENT ON COLUMN audit_logs.action IS 'Specific action performed';
COMMENT ON COLUMN audit_logs.action_category IS 'Category: FINANCIAL, SECURITY, DATA_ACCESS, CONFIGURATION';
COMMENT ON COLUMN audit_logs.severity IS 'INFO, WARNING, CRITICAL, SECURITY';
COMMENT ON COLUMN audit_logs.old_values IS 'JSON of record state before change';
COMMENT ON COLUMN audit_logs.new_values IS 'JSON of record state after change';
COMMENT ON COLUMN audit_logs.changed_fields IS 'Array of field names that were modified';
COMMENT ON COLUMN audit_logs.is_pci_relevant IS 'TRUE if payment card data involved (PCI DSS requirement)';
COMMENT ON COLUMN audit_logs.is_gdpr_relevant IS 'TRUE if personal data involved (GDPR requirement)';
COMMENT ON COLUMN audit_logs.request_id IS 'Correlation ID for distributed tracing';
COMMENT ON COLUMN audit_logs.response_time_ms IS 'Operation duration in milliseconds';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, audit_timestamp DESC);
-- CREATE INDEX idx_audit_user ON audit_logs(user_id, audit_timestamp DESC);
-- CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, audit_timestamp DESC);
-- CREATE INDEX idx_audit_event ON audit_logs(event_type, audit_timestamp DESC);
-- CREATE INDEX idx_audit_compliance ON audit_logs(is_pci_relevant, is_gdpr_relevant, audit_timestamp DESC);

-- Grant permissions
GRANT SELECT, INSERT ON audit_logs TO tartware_app;
-- Note: No UPDATE or DELETE permissions - audit logs are immutable

-- Success message
\echo '✓ Table created: audit_logs (27/37)'
\echo '  - Compliance audit trail'
\echo '  - PCI DSS & GDPR ready'
\echo '  - Immutable records'
\echo ''
