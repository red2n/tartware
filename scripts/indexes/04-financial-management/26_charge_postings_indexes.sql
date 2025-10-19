-- =====================================================
-- 26_charge_postings_indexes.sql
-- Indexes for charge_postings table
--
-- Performance optimization for financial transactions
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_charge_postings_tenant;
DROP INDEX IF EXISTS idx_charge_postings_folio;
DROP INDEX IF EXISTS idx_charge_postings_reservation;
DROP INDEX IF EXISTS idx_charge_postings_guest;
DROP INDEX IF EXISTS idx_charge_postings_business_date;
DROP INDEX IF EXISTS idx_charge_postings_posting_date;
DROP INDEX IF EXISTS idx_charge_postings_transaction_type;
DROP INDEX IF EXISTS idx_charge_postings_source;
DROP INDEX IF EXISTS idx_charge_postings_reconciliation;
DROP INDEX IF EXISTS idx_charge_postings_voided;
DROP INDEX IF EXISTS idx_charge_postings_department;

-- Multi-tenancy index
CREATE INDEX idx_charge_postings_tenant
    ON charge_postings(tenant_id, property_id, posting_date DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_charge_postings_tenant IS 'Tenant/property filtering with date sorting';

-- Folio transactions (most common query)
CREATE INDEX idx_charge_postings_folio
    ON charge_postings(folio_id, posting_date DESC, transaction_type)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_charge_postings_folio IS 'Folio transaction history';

-- Reservation charges
CREATE INDEX idx_charge_postings_reservation
    ON charge_postings(reservation_id, posting_date DESC)
    WHERE deleted_at IS NULL AND reservation_id IS NOT NULL;

COMMENT ON INDEX idx_charge_postings_reservation IS 'Reservation charge tracking';

-- Guest transaction history
CREATE INDEX idx_charge_postings_guest
    ON charge_postings(guest_id, posting_date DESC)
    WHERE deleted_at IS NULL AND guest_id IS NOT NULL;

COMMENT ON INDEX idx_charge_postings_guest IS 'Guest spending history';

-- Business date filtering (critical for night audit)
CREATE INDEX idx_charge_postings_business_date
    ON charge_postings(property_id, business_date, transaction_type)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_charge_postings_business_date IS 'Night audit and daily reporting';

-- Posting date range queries
CREATE INDEX idx_charge_postings_posting_date
    ON charge_postings(property_id, posting_date, posting_type)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_charge_postings_posting_date IS 'Date range financial reporting';

-- Transaction type analysis
CREATE INDEX idx_charge_postings_transaction_type
    ON charge_postings(property_id, transaction_type, posting_date DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_charge_postings_transaction_type IS 'Transaction type filtering and analysis';

-- Source system tracking (POS, SPA, etc.)
CREATE INDEX idx_charge_postings_source
    ON charge_postings(property_id, source_system, posting_date DESC)
    WHERE deleted_at IS NULL AND source_system IS NOT NULL;

COMMENT ON INDEX idx_charge_postings_source IS 'POS/SPA integration tracking';

-- Reconciliation tracking
CREATE INDEX idx_charge_postings_reconciliation
    ON charge_postings(property_id, is_reconciled, posting_date)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_charge_postings_reconciliation IS 'Unreconciled transactions';

-- Voided transactions
CREATE INDEX idx_charge_postings_voided
    ON charge_postings(property_id, is_voided, voided_at DESC)
    WHERE deleted_at IS NULL AND is_voided = TRUE;

COMMENT ON INDEX idx_charge_postings_voided IS 'Voided transaction audit trail';

-- Department/revenue center reporting
CREATE INDEX idx_charge_postings_department
    ON charge_postings(property_id, department_code, posting_date DESC)
    WHERE deleted_at IS NULL AND department_code IS NOT NULL;

COMMENT ON INDEX idx_charge_postings_department IS 'Departmental revenue reporting';

-- Success message
\echo '✓ Indexes created: charge_postings (26/37)'
\echo '  - 11 performance indexes'
\echo '  - Critical for financial operations'
\echo ''
