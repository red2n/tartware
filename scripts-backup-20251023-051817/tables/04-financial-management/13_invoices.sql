-- =====================================================
-- invoices.sql
-- Invoices Table
-- Industry Standard: Billing documents
-- Pattern: Oracle OPERA Folio, Accounting Integration
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating invoices table...'

-- =====================================================
-- INVOICES TABLE
-- Guest folios/invoices
-- Financial billing documents
-- =====================================================

CREATE TABLE IF NOT EXISTS invoices (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    reservation_id UUID NOT NULL,
    guest_id UUID NOT NULL,

    -- Invoice Number (human-readable)
    invoice_number VARCHAR(100) UNIQUE NOT NULL,

    -- Invoice Type
    invoice_type VARCHAR(50) DEFAULT 'standard',

    -- Dates
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    -- Billing Period
    billing_from DATE,
    billing_to DATE,

    -- Amounts
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15,2) DEFAULT 0.00,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Tax Details
    tax_breakdown JSONB DEFAULT '[]'::jsonb,

    -- Status
    status invoice_status NOT NULL DEFAULT 'DRAFT',

    -- Payment Terms
    payment_terms VARCHAR(255),
    payment_instructions TEXT,

    -- Billing Address
    billing_address JSONB DEFAULT '{
        "name": "",
        "company": "",
        "street": "",
        "city": "",
        "state": "",
        "postalCode": "",
        "country": ""
    }'::jsonb,

    -- Notes
    notes TEXT,
    footer_text TEXT,

    -- PDF Generation
    pdf_url VARCHAR(500),
    pdf_generated_at TIMESTAMP,

    -- Sent Information
    sent_at TIMESTAMP,
    sent_to VARCHAR(255),

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT invoices_amounts_check CHECK (
        subtotal >= 0 AND
        tax_amount >= 0 AND
        discount_amount >= 0 AND
        total_amount >= 0 AND
        paid_amount >= 0
    ),
    CONSTRAINT invoices_billing_period CHECK (
        billing_from IS NULL OR billing_to IS NULL OR billing_from <= billing_to
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE invoices IS 'Guest invoices/folios (billing documents)';
COMMENT ON COLUMN invoices.id IS 'Unique invoice identifier (UUID)';
COMMENT ON COLUMN invoices.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN invoices.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN invoices.reservation_id IS 'Reference to reservations.id';
COMMENT ON COLUMN invoices.guest_id IS 'Reference to guests.id';
COMMENT ON COLUMN invoices.invoice_number IS 'Human-readable invoice number (e.g., INV-2024-00001)';
COMMENT ON COLUMN invoices.invoice_type IS 'Type: standard, proforma, credit_note, debit_note';
COMMENT ON COLUMN invoices.subtotal IS 'Total before tax and discounts';
COMMENT ON COLUMN invoices.tax_amount IS 'Total tax amount';
COMMENT ON COLUMN invoices.discount_amount IS 'Total discounts applied';
COMMENT ON COLUMN invoices.total_amount IS 'Final invoice total';
COMMENT ON COLUMN invoices.balance_due IS 'Computed: total_amount - paid_amount';
COMMENT ON COLUMN invoices.status IS 'ENUM: draft, issued, paid, partially_paid, overdue, cancelled, void';
COMMENT ON COLUMN invoices.tax_breakdown IS 'Detailed tax breakdown by type (JSONB)';
COMMENT ON COLUMN invoices.billing_address IS 'Billing address (JSONB)';
COMMENT ON COLUMN invoices.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Invoices table created successfully!'
