-- =====================================================
-- 25_folios_indexes.sql
-- Indexes for folios table
--
-- Performance optimization for guest billing accounts
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_folios_tenant;
DROP INDEX IF EXISTS idx_folios_property;
DROP INDEX IF EXISTS idx_folios_number;
DROP INDEX IF EXISTS idx_folios_reservation;
DROP INDEX IF EXISTS idx_folios_guest;
DROP INDEX IF EXISTS idx_folios_status;
DROP INDEX IF EXISTS idx_folios_type;
DROP INDEX IF EXISTS idx_folios_balance;
DROP INDEX IF EXISTS idx_folios_created;

-- Multi-tenancy index (most queries filter by tenant/property)
CREATE INDEX idx_folios_tenant
    ON folios(tenant_id, property_id, created_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folios_tenant IS 'Tenant/property filtering with recency';

-- Property-wide queries
CREATE INDEX idx_folios_property
    ON folios(property_id, folio_status, created_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folios_property IS 'Property folio management with status filtering';

-- Folio number lookup (unique, but need index for performance)
CREATE INDEX idx_folios_number
    ON folios(tenant_id, property_id, folio_number)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folios_number IS 'Fast folio number lookup';

-- Reservation association
CREATE INDEX idx_folios_reservation
    ON folios(reservation_id, folio_status)
    WHERE deleted_at IS NULL AND reservation_id IS NOT NULL;

COMMENT ON INDEX idx_folios_reservation IS 'Reservation-to-folio relationship';

-- Guest folio history
CREATE INDEX idx_folios_guest
    ON folios(guest_id, created_at DESC)
    WHERE deleted_at IS NULL AND guest_id IS NOT NULL;

COMMENT ON INDEX idx_folios_guest IS 'Guest billing history';

-- Status-based queries (open folios, etc.)
CREATE INDEX idx_folios_status
    ON folios(property_id, folio_status, updated_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folios_status IS 'Status filtering for daily operations';

-- Folio type filtering
CREATE INDEX idx_folios_type
    ON folios(property_id, folio_type, folio_status)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folios_type IS 'Type-based filtering (GUEST, MASTER, CITY_LEDGER)';

-- Outstanding balance tracking
CREATE INDEX idx_folios_balance
    ON folios(property_id, balance, updated_at DESC)
    WHERE deleted_at IS NULL AND balance != 0;

COMMENT ON INDEX idx_folios_balance IS 'Find folios with outstanding balance';

-- Creation date for reporting
CREATE INDEX idx_folios_created
    ON folios(property_id, created_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folios_created IS 'Date-based reporting and analytics';

-- Success message
\echo '✓ Indexes created: folios (25/37)'
\echo '  - 9 performance indexes'
\echo '  - Partial indexes for active records'
\echo ''
