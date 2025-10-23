-- =====================================================
-- 29_night_audit_log_indexes.sql
-- Indexes for night_audit_log table
--
-- Performance optimization for EOD process tracking
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_night_audit_tenant;
DROP INDEX IF EXISTS idx_night_audit_run;
DROP INDEX IF EXISTS idx_night_audit_business_date;
DROP INDEX IF EXISTS idx_night_audit_status;
DROP INDEX IF EXISTS idx_night_audit_attention;
DROP INDEX IF EXISTS idx_night_audit_started;

-- Multi-tenancy index
CREATE INDEX idx_night_audit_tenant
    ON night_audit_log(tenant_id, property_id, business_date DESC, started_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_night_audit_tenant IS 'Tenant/property audit history';

-- Audit run grouping (all steps of one run)
CREATE INDEX idx_night_audit_run
    ON night_audit_log(audit_run_id, step_number);

COMMENT ON INDEX idx_night_audit_run IS 'Group all steps of a single audit run';

-- Business date lookup
CREATE INDEX idx_night_audit_business_date
    ON night_audit_log(property_id, business_date DESC, audit_status);

COMMENT ON INDEX idx_night_audit_business_date IS 'Find audits by business date';

-- Status tracking (in progress, failed, etc.)
CREATE INDEX idx_night_audit_status
    ON night_audit_log(property_id, audit_status, started_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_night_audit_status IS 'Track audit status';

-- Failed/warning audits requiring attention
CREATE INDEX idx_night_audit_attention
    ON night_audit_log(property_id, requires_attention, started_at DESC)
    WHERE requires_attention = TRUE AND deleted_at IS NULL;

COMMENT ON INDEX idx_night_audit_attention IS 'Failed audits needing review';

-- Recent audit runs
CREATE INDEX idx_night_audit_started
    ON night_audit_log(property_id, started_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_night_audit_started IS 'Recent audit activity';

-- Success message
\echo '✓ Indexes created: night_audit_log (29/37)'
\echo '  - 6 performance indexes'
\echo '  - EOD process optimized'
\echo ''
