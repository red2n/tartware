-- =====================================================
-- payments.sql
-- Payments Table
-- Industry Standard: Payment transactions
-- Pattern: Oracle OPERA Cashiering, Payment Gateway Integration
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating payments table...'

-- =====================================================
-- PAYMENTS TABLE
-- Payment transactions for reservations
-- Financial audit trail
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    reservation_id UUID NOT NULL,
    guest_id UUID NOT NULL,

    -- Payment Reference
    payment_reference VARCHAR(100) UNIQUE NOT NULL,
    external_transaction_id VARCHAR(255),

    -- Transaction Details
    transaction_type transaction_type NOT NULL,
    payment_method payment_method NOT NULL,

    -- Amount
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Exchange Rate (for foreign currency)
    exchange_rate DECIMAL(15,6) DEFAULT 1.0,
    base_amount DECIMAL(15,2),
    base_currency VARCHAR(3) DEFAULT 'USD',

    -- Payment Status
    status payment_status NOT NULL DEFAULT 'PENDING',

    -- Payment Gateway Details
    gateway_name VARCHAR(100),
    gateway_response JSONB DEFAULT '{}'::jsonb,

    -- Card Details (if applicable)
    card_type VARCHAR(50),
    card_last4 VARCHAR(4),
    card_holder_name VARCHAR(255),

    -- Processing
    processed_at TIMESTAMP,
    processed_by VARCHAR(100),

    -- Refund Information
    refund_amount DECIMAL(15,2) DEFAULT 0.00,
    refund_date TIMESTAMP,
    refund_reason TEXT,
    refunded_by VARCHAR(100),

    -- Notes
    notes TEXT,

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
    CONSTRAINT payments_amount_check CHECK (amount > 0),
    CONSTRAINT payments_refund_check CHECK (refund_amount >= 0 AND refund_amount <= amount),
    CONSTRAINT payments_exchange_rate_check CHECK (exchange_rate > 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE payments IS 'Payment transactions for reservations';
COMMENT ON COLUMN payments.id IS 'Unique payment identifier (UUID)';
COMMENT ON COLUMN payments.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN payments.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN payments.reservation_id IS 'Reference to reservations.id';
COMMENT ON COLUMN payments.guest_id IS 'Reference to guests.id';
COMMENT ON COLUMN payments.payment_reference IS 'Unique payment reference number';
COMMENT ON COLUMN payments.external_transaction_id IS 'External payment gateway transaction ID';
COMMENT ON COLUMN payments.transaction_type IS 'ENUM: charge, refund, adjustment, deposit, balance';
COMMENT ON COLUMN payments.payment_method IS 'ENUM: cash, credit_card, debit_card, bank_transfer, mobile_payment, voucher, comp';
COMMENT ON COLUMN payments.status IS 'ENUM: pending, authorized, captured, completed, failed, refunded, cancelled';
COMMENT ON COLUMN payments.gateway_name IS 'Payment gateway used (Stripe, PayPal, Square, etc.)';
COMMENT ON COLUMN payments.gateway_response IS 'Full gateway response (JSONB)';
COMMENT ON COLUMN payments.refund_amount IS 'Amount refunded (0 = no refund)';
COMMENT ON COLUMN payments.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Payments table created successfully!'
