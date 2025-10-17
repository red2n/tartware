-- =====================================================
-- invoice_items.sql
-- Invoice Items Table
-- Industry Standard: Invoice line items
-- Pattern: Oracle OPERA Folio Charges, Line Item Detail
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating invoice_items table...'

-- =====================================================
-- INVOICE_ITEMS TABLE
-- Individual line items on invoices
-- Room charges, services, taxes, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_items (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    invoice_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Item Details
    item_type VARCHAR(50) NOT NULL,
    item_code VARCHAR(100),
    description TEXT NOT NULL,

    -- Quantity & Pricing
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    subtotal DECIMAL(15,2) NOT NULL,

    -- Tax
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    tax_amount DECIMAL(15,2) DEFAULT 0.00,

    -- Discount
    discount_rate DECIMAL(5,2) DEFAULT 0.00,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,

    -- Total
    total_amount DECIMAL(15,2) NOT NULL,

    -- Date
    service_date DATE,

    -- Reference (optional: link to service, room, etc.)
    reference_type VARCHAR(50),
    reference_id UUID,

    -- Display Order
    line_number INTEGER DEFAULT 0,

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

    -- Constraints
    CONSTRAINT invoice_items_quantity_check CHECK (quantity > 0),
    CONSTRAINT invoice_items_amounts_check CHECK (
        unit_price >= 0 AND
        subtotal >= 0 AND
        tax_amount >= 0 AND
        discount_amount >= 0 AND
        total_amount >= 0
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE invoice_items IS 'Invoice line items (charges, services, taxes)';
COMMENT ON COLUMN invoice_items.id IS 'Unique line item identifier (UUID)';
COMMENT ON COLUMN invoice_items.invoice_id IS 'Reference to invoices.id';
COMMENT ON COLUMN invoice_items.item_type IS 'Type: room, service, tax, fee, discount, adjustment';
COMMENT ON COLUMN invoice_items.item_code IS 'Internal item/charge code';
COMMENT ON COLUMN invoice_items.description IS 'Line item description';
COMMENT ON COLUMN invoice_items.quantity IS 'Quantity (e.g., number of nights, units)';
COMMENT ON COLUMN invoice_items.unit_price IS 'Price per unit';
COMMENT ON COLUMN invoice_items.subtotal IS 'Quantity * unit_price';
COMMENT ON COLUMN invoice_items.total_amount IS 'Final line total (subtotal + tax - discount)';
COMMENT ON COLUMN invoice_items.service_date IS 'Date service was provided';
COMMENT ON COLUMN invoice_items.reference_type IS 'Type of referenced entity (service, reservation_service, etc.)';
COMMENT ON COLUMN invoice_items.reference_id IS 'UUID of referenced entity';
COMMENT ON COLUMN invoice_items.line_number IS 'Line number for display order';

\echo 'Invoice_items table created successfully!'
