-- =====================================================
-- 26_charge_postings.sql
-- Charge Postings / Financial Transactions
--
-- Purpose: Track all charges posted to guest folios
-- Industry Standard: OPERA (FINANCIAL_TRANSACTIONS), Cloudbeds (charges),
--                    Protel (BUCHUNGEN_DETAIL), RMS (Transaction)
--
-- Transaction Types:
-- - CHARGE: Debit transaction (increases folio balance)
-- - PAYMENT: Credit transaction (decreases balance)
-- - ADJUSTMENT: Correction/modification
-- - REFUND: Money returned to guest
-- - TRANSFER: Move between folios
--
-- Features:
-- - Multi-tenancy support
-- - Soft delete capability
-- - Voiding/reversal support
-- - Audit trail
-- - POS integration ready
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS charge_postings CASCADE;

CREATE TABLE charge_postings (
    -- Primary Key
    posting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Folio Association
    folio_id UUID NOT NULL,
    reservation_id UUID, -- Optional: may not be linked to reservation
    guest_id UUID,

    -- Transaction Details
    posting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    posting_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    business_date DATE NOT NULL, -- Property business date when posted

    -- Transaction Type
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN
        ('CHARGE', 'PAYMENT', 'ADJUSTMENT', 'REFUND', 'TRANSFER', 'VOID')),
    posting_type VARCHAR(20) NOT NULL CHECK (posting_type IN
        ('DEBIT', 'CREDIT')), -- DEBIT increases balance, CREDIT decreases

    -- Charge Details
    charge_code VARCHAR(50) NOT NULL, -- e.g., ROOM, F&B, SPA, MINIBAR, PHONE
    charge_description VARCHAR(500) NOT NULL,
    charge_category VARCHAR(50), -- Room, Food & Beverage, Services, Taxes, etc.

    -- Financial Amounts
    quantity DECIMAL(10, 3) DEFAULT 1.000,
    unit_price DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    service_charge DECIMAL(12, 2) DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency_code CHAR(3) DEFAULT 'USD',

    -- Tax Details
    tax_rate DECIMAL(5, 2),
    tax_code VARCHAR(20),
    tax_inclusive BOOLEAN DEFAULT FALSE,

    -- Payment Details (if transaction_type = PAYMENT)
    payment_method VARCHAR(50), -- CASH, CARD, BANK_TRANSFER, CHEQUE, etc.
    payment_reference VARCHAR(100), -- Card last 4 digits, cheque number, etc.
    authorization_code VARCHAR(50), -- Card authorization code

    -- Source Information
    source_system VARCHAR(50), -- PMS, POS, SPA, MINIBAR, etc.
    source_reference VARCHAR(100), -- External system reference
    outlet VARCHAR(100), -- Restaurant name, spa name, etc.

    -- Department/Revenue Center
    department_code VARCHAR(20),
    revenue_center VARCHAR(50),
    gl_account VARCHAR(50), -- General ledger account code

    -- Void/Reversal Information
    is_voided BOOLEAN DEFAULT FALSE,
    voided_at TIMESTAMP,
    voided_by UUID,
    void_reason VARCHAR(500),
    original_posting_id UUID, -- If this is a void of another posting
    void_posting_id UUID, -- If this posting was voided by another

    -- Transfer Information (if transaction_type = TRANSFER)
    transfer_from_folio_id UUID,
    transfer_to_folio_id UUID,

    -- Routing Rule (if charge was auto-routed by folio routing engine)
    routing_rule_id UUID, -- FK to folio_routing_rules.rule_id

    -- Night Audit Traceability
    audit_run_id UUID, -- UUID of the night_audit_log run that created this posting; NULL for manual charges

    -- Staff Information
    server_name VARCHAR(100), -- Waiter/server name
    cashier_name VARCHAR(100),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP,
    reconciliation_batch VARCHAR(50),

        created_by UUID,
        updated_by UUID,
        updated_at TIMESTAMP, -- Last modification timestamp

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
        deleted_by UUID,

    -- Optimistic Locking
    version BIGINT DEFAULT 0,
    -- Foreign Keys (will be added via constraints file)
    -- FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    -- FOREIGN KEY (property_id) REFERENCES properties(property_id),
    -- FOREIGN KEY (folio_id) REFERENCES folios(folio_id),
    -- FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
    -- FOREIGN KEY (guest_id) REFERENCES guests(guest_id),
    -- FOREIGN KEY (original_posting_id) REFERENCES charge_postings(posting_id),
    -- FOREIGN KEY (void_posting_id) REFERENCES charge_postings(posting_id),

    -- Check Constraints
    CONSTRAINT chk_postings_total CHECK (
        total_amount = subtotal + tax_amount + service_charge - discount_amount
    ),
    CONSTRAINT chk_postings_void CHECK (
        (is_voided = TRUE AND voided_at IS NOT NULL AND voided_by IS NOT NULL) OR
        (is_voided = FALSE)
    ),
    CONSTRAINT chk_postings_payment CHECK (
        (transaction_type = 'PAYMENT' AND payment_method IS NOT NULL) OR
        (transaction_type != 'PAYMENT')
    )
);

COMMENT ON TABLE charge_postings IS 'All financial transactions (charges and payments) posted to guest folios';

COMMENT ON COLUMN charge_postings.posting_id IS 'Unique identifier for posting';
COMMENT ON COLUMN charge_postings.business_date IS 'Property business date (for night audit)';
COMMENT ON COLUMN charge_postings.transaction_type IS 'CHARGE, PAYMENT, ADJUSTMENT, REFUND, TRANSFER, VOID';
COMMENT ON COLUMN charge_postings.posting_type IS 'DEBIT (increases balance) or CREDIT (decreases balance)';
COMMENT ON COLUMN charge_postings.charge_code IS 'Standardized charge code (ROOM, F&B, SPA, etc.)';
COMMENT ON COLUMN charge_postings.quantity IS 'Quantity (e.g., 2.5 hours of spa service)';
COMMENT ON COLUMN charge_postings.source_system IS 'Origin of charge: PMS, POS, SPA, MINIBAR, etc.';
COMMENT ON COLUMN charge_postings.is_voided IS 'Whether this transaction has been voided/reversed';
COMMENT ON COLUMN charge_postings.void_posting_id IS 'Reference to the void transaction if this was voided';
COMMENT ON COLUMN charge_postings.gl_account IS 'General ledger account code for accounting integration';
COMMENT ON COLUMN charge_postings.routing_rule_id IS 'FK to folio_routing_rules — set when charge was auto-routed by the routing engine';
COMMENT ON COLUMN charge_postings.audit_run_id IS 'UUID of the night audit run that created this posting; NULL for manually-posted charges';

-- Idempotent migration: add audit_run_id to existing deployments
ALTER TABLE charge_postings ADD COLUMN IF NOT EXISTS audit_run_id UUID;

-- Index: look up all postings for a given audit run (used by rollback / idempotency checks)
CREATE INDEX IF NOT EXISTS idx_charge_postings_audit_run_id
    ON charge_postings (audit_run_id)
    WHERE audit_run_id IS NOT NULL;

-- Partial index for fast idempotency check: "does a non-voided room charge already
-- exist for this reservation on this business date from any night audit?"
CREATE INDEX IF NOT EXISTS idx_charge_postings_nightly_dedup
    ON charge_postings (tenant_id, reservation_id, business_date, charge_code)
    WHERE audit_run_id IS NOT NULL AND COALESCE(is_voided, false) = false;

-- =====================================================
-- HTNG POS Integration columns (ACCT-05)
-- =====================================================
-- POS transaction ID from external POS system (HTNG-standard idempotency key)
ALTER TABLE charge_postings ADD COLUMN IF NOT EXISTS pos_transaction_id VARCHAR(100);
-- POS outlet code: F&B, SPA, MINIBAR, GOLF, RETAIL, PARKING, etc.
ALTER TABLE charge_postings ADD COLUMN IF NOT EXISTS outlet_code VARCHAR(50);
-- POS check/receipt number
ALTER TABLE charge_postings ADD COLUMN IF NOT EXISTS check_number VARCHAR(50);
-- Number of covers/guests on the POS check
ALTER TABLE charge_postings ADD COLUMN IF NOT EXISTS covers INTEGER;

COMMENT ON COLUMN charge_postings.pos_transaction_id IS 'HTNG POS transaction ID — unique per POS terminal; used as idempotency key to prevent duplicate charges on POS retry';
COMMENT ON COLUMN charge_postings.outlet_code IS 'POS outlet identifier: F&B, SPA, MINIBAR, GOLF, RETAIL, PARKING, etc. Maps to USALI department codes';
COMMENT ON COLUMN charge_postings.check_number IS 'POS check/receipt number for cross-reference with POS system';
COMMENT ON COLUMN charge_postings.covers IS 'Number of guests/covers on the POS check (relevant for F&B revenue analytics)';

-- Unique partial index on pos_transaction_id for POS deduplication (ACCT-05)
-- Scoped per tenant; allows NULL (non-POS charges)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_charge_postings_pos_txn
    ON charge_postings (tenant_id, pos_transaction_id)
    WHERE pos_transaction_id IS NOT NULL;

-- Supporting index for POS charge lookups by tenant + outlet
CREATE INDEX IF NOT EXISTS idx_charge_postings_outlet
    ON charge_postings (tenant_id, outlet_code)
    WHERE outlet_code IS NOT NULL;


GRANT SELECT, INSERT, UPDATE ON charge_postings TO tartware_app;

-- ── Per-table autovacuum tuning ─────────────────────────────────────────────
-- charge_postings grows by millions of rows per night audit; default scale_factor
-- of 0.2 would delay vacuum for too long.
ALTER TABLE charge_postings SET (
    autovacuum_vacuum_scale_factor     = 0.01,
    autovacuum_vacuum_cost_delay       = 0,
    autovacuum_analyze_scale_factor    = 0.005
);

\echo '✓ Table created: charge_postings (26/37)'
\echo '  - All folio transactions'
\echo '  - POS integration support'
\echo '  - Void/reversal capability'
\echo ''
