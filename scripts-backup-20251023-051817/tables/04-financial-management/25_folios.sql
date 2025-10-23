-- =====================================================
-- 25_folios.sql
-- Guest Billing Accounts (Folios)
--
-- Purpose: Manage guest billing accounts and folio tracking
-- Industry Standard: OPERA, Cloudbeds, Protel (KONTEN), RMS (Account)
--
-- Folio Types:
-- - GUEST: Individual guest folio
-- - MASTER: Group/company master folio
-- - CITY_LEDGER: Direct billing account
--
-- Features:
-- - Multi-tenancy support
-- - Soft delete capability
-- - Balance tracking
-- - Split billing support
-- - Audit trail
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS folios CASCADE;

CREATE TABLE folios (
    -- Primary Key
    folio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Folio Information
    folio_number VARCHAR(50) NOT NULL, -- Human-readable folio number
    folio_type VARCHAR(20) NOT NULL CHECK (folio_type IN ('GUEST', 'MASTER', 'CITY_LEDGER')),
    folio_status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (folio_status IN ('OPEN', 'CLOSED', 'TRANSFERRED', 'SETTLED')),

    -- Associated Reservation (optional - may be city ledger without reservation)
    reservation_id UUID,

    -- Guest Information
    guest_id UUID,
    guest_name VARCHAR(200), -- Denormalized for quick access

    -- Company/Group Information (for master folios)
    company_name VARCHAR(200),
    company_reference VARCHAR(100),

    -- Financial Tracking
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_charges DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_payments DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_credits DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    currency_code CHAR(3) DEFAULT 'USD',

    -- Billing Information
    billing_address_line1 VARCHAR(200),
    billing_address_line2 VARCHAR(200),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country CHAR(2), -- ISO 3166-1 alpha-2

    -- Tax Information
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_id VARCHAR(50), -- Company tax ID / VAT number

    -- Settlement Information
    settled_at TIMESTAMP,
    settled_by UUID, -- Reference to users table
    settlement_method VARCHAR(50),

    -- Transfer Information (if folio was transferred)
    transferred_from_folio_id UUID,
    transferred_to_folio_id UUID,
    transferred_at TIMESTAMP,

    -- Notes and References
    notes TEXT,
    internal_notes TEXT,
    reference_number VARCHAR(100), -- PO number, booking reference, etc.

    -- Timestamps
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,

    -- Soft Delete Support
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit Trail
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Foreign Keys (will be added via constraints file)
    -- FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    -- FOREIGN KEY (property_id) REFERENCES properties(property_id),
    -- FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
    -- FOREIGN KEY (guest_id) REFERENCES guests(guest_id),
    -- FOREIGN KEY (created_by) REFERENCES users(user_id),
    -- FOREIGN KEY (updated_by) REFERENCES users(user_id),

    -- Unique Constraints
    CONSTRAINT uk_folios_number UNIQUE (tenant_id, property_id, folio_number),

    -- Check Constraints
    CONSTRAINT chk_folios_balance CHECK (balance = total_charges - total_payments - total_credits),
    CONSTRAINT chk_folios_settled CHECK (
        (folio_status = 'SETTLED' AND settled_at IS NOT NULL) OR
        (folio_status != 'SETTLED' AND settled_at IS NULL)
    )
);

-- Add table comment
COMMENT ON TABLE folios IS 'Guest billing accounts (folios) for charge posting and payment tracking';

-- Add column comments
COMMENT ON COLUMN folios.folio_id IS 'Unique identifier for folio';
COMMENT ON COLUMN folios.folio_number IS 'Human-readable folio number (e.g., F-2024-001234)';
COMMENT ON COLUMN folios.folio_type IS 'Type of folio: GUEST (individual), MASTER (group/company), CITY_LEDGER (direct billing)';
COMMENT ON COLUMN folios.folio_status IS 'Current status: OPEN, CLOSED, TRANSFERRED, SETTLED';
COMMENT ON COLUMN folios.balance IS 'Current balance = total_charges - total_payments - total_credits';
COMMENT ON COLUMN folios.tax_exempt IS 'Whether this folio is tax exempt';
COMMENT ON COLUMN folios.transferred_from_folio_id IS 'Source folio if this was created from a transfer';
COMMENT ON COLUMN folios.transferred_to_folio_id IS 'Destination folio if this was transferred';
COMMENT ON COLUMN folios.reference_number IS 'External reference (PO number, booking ref, etc.)';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_folios_tenant ON folios(tenant_id, property_id) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_folios_reservation ON folios(reservation_id) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_folios_guest ON folios(guest_id) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_folios_status ON folios(folio_status, opened_at DESC) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_folios_number ON folios(tenant_id, folio_number) WHERE deleted_at IS NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON folios TO tartware_app;

-- Success message
\echo '✓ Table created: folios (25/37)'
\echo '  - Guest billing accounts'
\echo '  - Split billing support'
\echo '  - Multi-folio capability'
\echo ''
