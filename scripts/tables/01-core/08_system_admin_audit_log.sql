-- =====================================================
-- 08_system_admin_audit_log.sql
-- Privileged activity logging (append-only)
-- Pattern: SOX/PCI DSS audit retention, tamper evident hashing
-- Date: 2025-11-19
-- =====================================================

\c tartware \echo 'Creating system_admin_audit_log table...'

CREATE TABLE IF NOT EXISTS system_admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES system_administrators(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    tenant_id UUID REFERENCES tenants(id),
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_payload JSONB,
    response_status INTEGER,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    impersonated_user_id UUID,
    ticket_id VARCHAR(100),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE system_admin_audit_log IS 'Immutable ledger of privileged system administrator actions';
COMMENT ON COLUMN system_admin_audit_log.checksum IS 'SHA256 checksum to detect tampering of audit payload';

CREATE INDEX IF NOT EXISTS idx_system_admin_audit_by_admin ON system_admin_audit_log(admin_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_admin_audit_by_tenant ON system_admin_audit_log(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_admin_audit_by_action ON system_admin_audit_log(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_admin_audit_impersonated ON system_admin_audit_log(impersonated_user_id)
    WHERE impersonated_user_id IS NOT NULL;

ALTER TABLE system_admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_admin_audit_self_only ON system_admin_audit_log;
CREATE POLICY system_admin_audit_self_only ON system_admin_audit_log
    FOR SELECT
    USING (
        admin_id = current_setting('app.current_admin_id', true)::UUID
    );

\echo 'system_admin_audit_log table created.'
