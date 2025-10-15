-- =====================================================
-- 12_payments_indexes.sql
-- Indexes for payments table
-- Performance optimization for financial queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for payments table...'

-- Foreign key indexes (critical for joins)
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_property_id ON payments(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON payments(reservation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_guest_id ON payments(guest_id) WHERE deleted_at IS NULL;

-- Payment reference lookup (unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference ON payments(payment_reference) WHERE deleted_at IS NULL;

-- External transaction ID
CREATE INDEX IF NOT EXISTS idx_payments_external_transaction ON payments(external_transaction_id)
    WHERE external_transaction_id IS NOT NULL AND deleted_at IS NULL;

-- Transaction type and method
CREATE INDEX IF NOT EXISTS idx_payments_transaction_type ON payments(transaction_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method) WHERE deleted_at IS NULL;

-- Status queries (critical for payment processing)
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(status, created_at)
    WHERE status = 'PENDING' AND deleted_at IS NULL;

-- Composite for property payments
CREATE INDEX IF NOT EXISTS idx_payments_property_date ON payments(property_id, processed_at, deleted_at) WHERE deleted_at IS NULL;

-- Amount queries (for reporting)
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_currency ON payments(currency) WHERE deleted_at IS NULL;

-- Date queries
CREATE INDEX IF NOT EXISTS idx_payments_processed_at ON payments(processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Gateway tracking
CREATE INDEX IF NOT EXISTS idx_payments_gateway ON payments(gateway_name) WHERE gateway_name IS NOT NULL AND deleted_at IS NULL;

-- Card information (for PCI compliance queries)
CREATE INDEX IF NOT EXISTS idx_payments_card_type ON payments(card_type) WHERE card_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_card_last4 ON payments(card_last4) WHERE card_last4 IS NOT NULL;

-- Refund tracking
CREATE INDEX IF NOT EXISTS idx_payments_refund_amount ON payments(refund_amount) WHERE refund_amount > 0 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_refund_date ON payments(refund_date) WHERE refund_date IS NOT NULL;

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_payments_gateway_response_gin ON payments USING GIN(gateway_response);
CREATE INDEX IF NOT EXISTS idx_payments_metadata_gin ON payments USING GIN(metadata);

-- Composite for reservation payments (common query)
CREATE INDEX IF NOT EXISTS idx_payments_reservation_status ON payments(reservation_id, status, deleted_at) WHERE deleted_at IS NULL;

-- Failed payments tracking
CREATE INDEX IF NOT EXISTS idx_payments_failed ON payments(status, created_at)
    WHERE status = 'FAILED' AND deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_payments_updated_at ON payments(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON payments(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Payments indexes created successfully!'
