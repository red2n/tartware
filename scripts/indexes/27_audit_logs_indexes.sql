-- =====================================================
-- 27_audit_logs_indexes.sql
-- Indexes for audit_logs table
--
-- Performance optimization for compliance audit trail
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_audit_logs_tenant;
DROP INDEX IF EXISTS idx_audit_logs_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_user;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_event_type;
DROP INDEX IF EXISTS idx_audit_logs_compliance;
DROP INDEX IF EXISTS idx_audit_logs_severity;
DROP INDEX IF EXISTS idx_audit_logs_request;

-- Multi-tenancy index (most queries filter by tenant/property)
CREATE INDEX idx_audit_logs_tenant
    ON audit_logs(tenant_id, property_id, audit_timestamp DESC);

COMMENT ON INDEX idx_audit_logs_tenant IS 'Tenant/property audit trail with recency';

-- Timestamp-based queries (date range searches)
CREATE INDEX idx_audit_logs_timestamp
    ON audit_logs(property_id, audit_timestamp DESC, event_type);

COMMENT ON INDEX idx_audit_logs_timestamp IS 'Time-based audit queries';

-- User activity tracking
CREATE INDEX idx_audit_logs_user
    ON audit_logs(user_id, audit_timestamp DESC, event_type);

COMMENT ON INDEX idx_audit_logs_user IS 'User activity audit trail';

-- Entity tracking (what was changed)
CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id, audit_timestamp DESC);

COMMENT ON INDEX idx_audit_logs_entity IS 'Track changes to specific entities';

-- Event type filtering
CREATE INDEX idx_audit_logs_event_type
    ON audit_logs(property_id, event_type, audit_timestamp DESC);

COMMENT ON INDEX idx_audit_logs_event_type IS 'Event type filtering (CREATE, UPDATE, DELETE, etc.)';

-- Compliance queries (PCI DSS, GDPR)
CREATE INDEX idx_audit_logs_compliance
    ON audit_logs(property_id, is_pci_relevant, is_gdpr_relevant, audit_timestamp DESC)
    WHERE is_pci_relevant = TRUE OR is_gdpr_relevant = TRUE;

COMMENT ON INDEX idx_audit_logs_compliance IS 'Compliance-related audit queries';

-- Severity-based queries
CREATE INDEX idx_audit_logs_severity
    ON audit_logs(property_id, severity, audit_timestamp DESC)
    WHERE severity IN ('CRITICAL', 'SECURITY');

COMMENT ON INDEX idx_audit_logs_severity IS 'High-severity event tracking';

-- Request correlation
CREATE INDEX idx_audit_logs_request
    ON audit_logs(request_id, audit_timestamp)
    WHERE request_id IS NOT NULL;

COMMENT ON INDEX idx_audit_logs_request IS 'Distributed tracing support';

-- Success message
\echo '✓ Indexes created: audit_logs (27/37)'
\echo '  - 8 performance indexes'
\echo '  - Compliance-optimized'
\echo ''
