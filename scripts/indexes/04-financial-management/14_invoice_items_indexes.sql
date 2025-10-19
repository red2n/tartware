-- =====================================================
-- 14_invoice_items_indexes.sql
-- Indexes for invoice_items table
-- Performance optimization for line item queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for invoice_items table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_id ON invoice_items(tenant_id);

-- Item type queries
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_type ON invoice_items(item_type);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_code ON invoice_items(item_code) WHERE item_code IS NOT NULL;

-- Service date
CREATE INDEX IF NOT EXISTS idx_invoice_items_service_date ON invoice_items(service_date) WHERE service_date IS NOT NULL;

-- Reference tracking
CREATE INDEX IF NOT EXISTS idx_invoice_items_reference_type ON invoice_items(reference_type) WHERE reference_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_reference_id ON invoice_items(reference_id) WHERE reference_id IS NOT NULL;

-- Line number (for ordering)
CREATE INDEX IF NOT EXISTS idx_invoice_items_line_number ON invoice_items(invoice_id, line_number);

-- Amount queries
CREATE INDEX IF NOT EXISTS idx_invoice_items_total_amount ON invoice_items(total_amount);

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_invoice_items_metadata_gin ON invoice_items USING GIN(metadata);

-- Composite for invoice line items (most common query)
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_lines ON invoice_items(invoice_id, line_number);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_created_at ON invoice_items(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_items_updated_at ON invoice_items(updated_at);

\echo '✓ Invoice_items indexes created successfully!'
