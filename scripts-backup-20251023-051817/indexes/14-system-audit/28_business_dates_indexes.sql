-- =====================================================
-- 28_business_dates_indexes.sql
-- Indexes for business_dates table
--
-- Performance optimization for property date management
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_business_dates_tenant;
DROP INDEX IF EXISTS idx_business_dates_property_date;
DROP INDEX IF EXISTS idx_business_dates_status;
DROP INDEX IF EXISTS idx_business_dates_open;
DROP INDEX IF EXISTS idx_business_dates_audit_status;

-- Multi-tenancy index
CREATE INDEX idx_business_dates_tenant
    ON business_dates(tenant_id, property_id, business_date DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_business_dates_tenant IS 'Tenant/property date tracking';

-- Current business date lookup (most common query)
CREATE INDEX idx_business_dates_property_date
    ON business_dates(property_id, business_date DESC, date_status)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_business_dates_property_date IS 'Business date lookup by property';

-- Status filtering
CREATE INDEX idx_business_dates_status
    ON business_dates(property_id, date_status, business_date DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_business_dates_status IS 'Status-based filtering';

-- Find open business date (critical for operations)
CREATE INDEX idx_business_dates_open
    ON business_dates(property_id, business_date)
    WHERE deleted_at IS NULL AND date_status = 'OPEN';

COMMENT ON INDEX idx_business_dates_open IS 'Fast lookup of current open business date';

-- Night audit status tracking
CREATE INDEX idx_business_dates_audit_status
    ON business_dates(property_id, night_audit_status, business_date DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_business_dates_audit_status IS 'Night audit progress tracking';

-- Success message
\echo '✓ Indexes created: business_dates (28/37)'
\echo '  - 5 performance indexes'
\echo '  - Optimized for current date lookup'
\echo ''
