-- =====================================================
-- 08_system_admin_audit_log.sql
-- Privileged activity logging (append-only)
-- Pattern: SOX/PCI DSS audit retention, tamper evident hashing
-- Date: 2025-11-19
-- =====================================================

\c tartware \echo 'Creating system_admin_audit_log table...'

CREATE TABLE IF NOT EXISTS system_admin_audit_log (
    id BIGSERIAL PRIMARY KEY, -- Immutable unique record identifier
    admin_id UUID NOT NULL REFERENCES system_administrators (id), -- Acting system administrator
    action VARCHAR(100) NOT NULL, -- Action performed (e.g., 'CREATE_USER', 'DELETE_PROPERTY')
    resource_type VARCHAR(50), -- Type of resource affected (e.g., 'USER', 'PROPERTY')
    resource_id UUID, -- ID of the resource affected
    tenant_id UUID REFERENCES tenants (id), -- Tenant context for multi-tenant environments
    request_method VARCHAR(10), -- HTTP method used (e.g., 'POST', 'DELETE')
    request_path VARCHAR(500), -- API endpoint or path accessed
    request_payload JSONB, -- Request body payload
    response_status INTEGER, -- HTTP response status code
    ip_address INET, -- IP address of the requester
    user_agent TEXT, -- User agent string of the requester
    session_id VARCHAR(255), -- Session identifier if applicable
    impersonated_user_id UUID, -- If action was performed via impersonation, the original user ID
    ticket_id VARCHAR(100), -- Reference to an internal ticket or change request ID
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Time of the action
    checksum VARCHAR(64) NOT NULL, -- SHA256 checksum to ensure tamper-evidence
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb -- Additional contextual metadata
);

COMMENT ON TABLE system_admin_audit_log IS 'Immutable ledger of privileged system administrator actions';

COMMENT ON COLUMN system_admin_audit_log.checksum IS 'SHA256 checksum to detect tampering of audit payload';

CREATE INDEX IF NOT EXISTS idx_system_admin_audit_by_admin ON system_admin_audit_log (admin_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_admin_audit_by_tenant ON system_admin_audit_log (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_admin_audit_by_action ON system_admin_audit_log (action, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_admin_audit_impersonated ON system_admin_audit_log (impersonated_user_id)
WHERE
    impersonated_user_id IS NOT NULL;

ALTER TABLE system_admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_admin_audit_self_only ON system_admin_audit_log;

CREATE POLICY system_admin_audit_self_only ON system_admin_audit_log FOR
SELECT USING (
        admin_id = current_setting('app.current_admin_id', true)::UUID
    );

\echo 'system_admin_audit_log table created.'
