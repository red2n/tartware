-- =====================================================
-- 13_invoices_indexes.sql
-- Indexes for invoices table
-- Performance optimization for billing queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for invoices table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_property_id ON invoices(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_reservation_id ON invoices(reservation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_guest_id ON invoices(guest_id) WHERE deleted_at IS NULL;

-- Invoice number lookup (unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number) WHERE deleted_at IS NULL;

-- Invoice type
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type) WHERE deleted_at IS NULL;

-- Date queries
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE deleted_at IS NULL;

-- Billing period
CREATE INDEX IF NOT EXISTS idx_invoices_billing_from ON invoices(billing_from) WHERE billing_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_billing_to ON invoices(billing_to) WHERE billing_to IS NOT NULL;

-- Status queries (critical for collections)
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_property_status ON invoices(property_id, status, deleted_at) WHERE deleted_at IS NULL;

-- Overdue invoices (critical for collections)
CREATE INDEX IF NOT EXISTS idx_invoices_overdue ON invoices(due_date, status)
    WHERE status IN ('issued', 'partially_paid') AND deleted_at IS NULL;

-- Financial queries
CREATE INDEX IF NOT EXISTS idx_invoices_total_amount ON invoices(total_amount) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_balance_due ON invoices(balance_due) WHERE balance_due > 0 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_paid_amount ON invoices(paid_amount) WHERE deleted_at IS NULL;

-- Currency
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency) WHERE deleted_at IS NULL;

-- Composite for property invoicing
CREATE INDEX IF NOT EXISTS idx_invoices_property_date ON invoices(property_id, invoice_date, deleted_at) WHERE deleted_at IS NULL;

-- Sent tracking
CREATE INDEX IF NOT EXISTS idx_invoices_sent_at ON invoices(sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_sent_to ON invoices(sent_to) WHERE sent_to IS NOT NULL;

-- PDF generation
CREATE INDEX IF NOT EXISTS idx_invoices_pdf_generated ON invoices(pdf_generated_at) WHERE pdf_generated_at IS NOT NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tax_breakdown_gin ON invoices USING GIN(tax_breakdown);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_address_gin ON invoices USING GIN(billing_address);
CREATE INDEX IF NOT EXISTS idx_invoices_metadata_gin ON invoices USING GIN(metadata);

-- Composite for guest invoices
CREATE INDEX IF NOT EXISTS idx_invoices_guest_date ON invoices(guest_id, invoice_date DESC, deleted_at) WHERE deleted_at IS NULL;

-- Unpaid invoices alert
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid ON invoices(property_id, status, balance_due)
    WHERE status IN ('issued', 'partially_paid') AND balance_due > 0 AND deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_updated_at ON invoices(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Invoices indexes created successfully!'
