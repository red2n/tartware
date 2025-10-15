-- =====================================================
-- 35_refunds.sql
-- Refund Management & Processing
--
-- Purpose: Track refund requests and processing
-- Industry Standard: OPERA (REFUND), Cloudbeds (refunds),
--                    Protel (RUECKERSTATTUNG), RMS (refund)
--
-- Use Cases:
-- - Cancellation refunds
-- - Overpayment refunds
-- - Service failure compensation
-- - Damage deposit returns
-- - Dispute resolution
--
-- Tracks refund lifecycle from request to completion
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS refunds CASCADE;

CREATE TABLE refunds (
    -- Primary Key
    refund_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Refund Information
    refund_number VARCHAR(50), -- Human-readable reference
    refund_type VARCHAR(30) NOT NULL
        CHECK (refund_type IN ('CANCELLATION', 'OVERPAYMENT', 'SERVICE_FAILURE', 'DISPUTE', 'DAMAGE_DEPOSIT', 'LOYALTY_REDEMPTION', 'COMPENSATION', 'OTHER')),

    -- Status
    refund_status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
        CHECK (refund_status IN ('REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED')),

    -- Association
    reservation_id UUID,
    guest_id UUID NOT NULL,
    folio_id UUID,
    original_payment_id UUID, -- Payment being refunded
    original_posting_id UUID, -- Charge being reversed

    -- Amounts
    refund_amount DECIMAL(12, 2) NOT NULL,
    original_payment_amount DECIMAL(12, 2),
    processing_fee DECIMAL(10, 2) DEFAULT 0.00,
    net_refund_amount DECIMAL(12, 2), -- After fees
    currency_code CHAR(3) DEFAULT 'USD',

    -- Original Payment Details
    original_payment_method VARCHAR(50),
    original_transaction_id VARCHAR(100),
    original_payment_date DATE,

    -- Refund Method
    refund_method VARCHAR(50) NOT NULL
        CHECK (refund_method IN ('ORIGINAL_PAYMENT_METHOD', 'CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'CHECK', 'STORE_CREDIT', 'OTHER')),

    -- Payment Details (for refund)
    card_last_four CHAR(4),
    card_type VARCHAR(20),
    bank_account_last_four CHAR(4),
    bank_routing_number VARCHAR(20),
    payee_name VARCHAR(200),

    -- Reason
    reason_category VARCHAR(50) NOT NULL
        CHECK (reason_category IN ('CANCELLATION', 'NO_SHOW', 'EARLY_DEPARTURE', 'SERVICE_ISSUE', 'OVERCHARGE', 'DUPLICATE_CHARGE', 'PRICE_ADJUSTMENT', 'DISPUTE', 'GOODWILL', 'OTHER')),
    reason_code VARCHAR(50),
    reason_description TEXT NOT NULL,

    -- Request Information
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requested_by UUID NOT NULL, -- User who initiated
    request_source VARCHAR(30), -- GUEST, STAFF, AUTOMATIC, CHARGEBACK

    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT TRUE,
    approval_level INTEGER DEFAULT 1,
    approved_at TIMESTAMP,
    approved_by UUID,
    approval_notes TEXT,

    rejected_at TIMESTAMP,
    rejected_by UUID,
    rejection_reason TEXT,

    -- Processing
    processing_started_at TIMESTAMP,
    processing_started_by UUID,
    processed_at TIMESTAMP,
    processed_by UUID,
    processing_notes TEXT,

    -- Transaction Details
    transaction_id VARCHAR(100), -- Refund transaction ID
    authorization_code VARCHAR(50),
    processor_response TEXT,
    processor_reference VARCHAR(100),

    -- Timing
    expected_completion_date DATE,
    completed_at TIMESTAMP,
    days_to_complete INTEGER,

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP,
    reconciliation_batch VARCHAR(50),

    -- Accounting
    gl_account VARCHAR(50),
    department_code VARCHAR(50),
    cost_center VARCHAR(50),

    -- Chargeback Information
    is_chargeback BOOLEAN DEFAULT FALSE,
    chargeback_date DATE,
    chargeback_reason VARCHAR(200),
    chargeback_reference VARCHAR(100),

    -- Guest Communication
    guest_notified BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,
    notification_method VARCHAR(30), -- EMAIL, SMS, MAIL
    confirmation_number VARCHAR(50),

    -- Internal Tracking
    is_full_refund BOOLEAN, -- TRUE if 100% refund
    refund_percentage DECIMAL(5, 2),
    is_taxable BOOLEAN DEFAULT FALSE,
    tax_refunded DECIMAL(10, 2),

    -- Quality/Risk Flags
    is_disputed BOOLEAN DEFAULT FALSE,
    dispute_notes TEXT,
    is_fraudulent BOOLEAN DEFAULT FALSE,
    fraud_notes TEXT,
    requires_investigation BOOLEAN DEFAULT FALSE,

    -- Related Refunds
    parent_refund_id UUID, -- For partial refunds
    split_refund_count INTEGER, -- Number of splits

    -- Metadata
    metadata JSONB,

    -- Notes
    notes TEXT,
    internal_notes TEXT,
    guest_facing_notes TEXT,

    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    CONSTRAINT uk_refunds_number
        UNIQUE (tenant_id, property_id, refund_number),

    -- Net amount calculation
    CONSTRAINT chk_refunds_net_amount
        CHECK (
            net_refund_amount IS NULL OR
            net_refund_amount = refund_amount - processing_fee
        ),

    -- Refund amount must be positive
    CONSTRAINT chk_refunds_amount
        CHECK (refund_amount > 0),

    -- Processing fee validation
    CONSTRAINT chk_refunds_fee
        CHECK (
            processing_fee IS NULL OR
            processing_fee >= 0
        ),

    -- Approved status requires approval info
    CONSTRAINT chk_refunds_approval
        CHECK (
            refund_status NOT IN ('APPROVED', 'PROCESSING', 'COMPLETED') OR
            (approved_at IS NOT NULL AND approved_by IS NOT NULL)
        ),

    -- Completed status requires completion timestamp
    CONSTRAINT chk_refunds_completed
        CHECK (
            refund_status != 'COMPLETED' OR
            completed_at IS NOT NULL
        ),

    -- Percentage validation
    CONSTRAINT chk_refunds_percentage
        CHECK (
            refund_percentage IS NULL OR
            (refund_percentage >= 0 AND refund_percentage <= 100)
        )
);

-- Add table comment
COMMENT ON TABLE refunds IS 'Refund request and processing tracking. Handles cancellations, overpayments, disputes, and compensation refunds.';

-- Add column comments
COMMENT ON COLUMN refunds.refund_type IS 'CANCELLATION, OVERPAYMENT, SERVICE_FAILURE, DISPUTE, DAMAGE_DEPOSIT, LOYALTY_REDEMPTION, COMPENSATION, OTHER';
COMMENT ON COLUMN refunds.refund_status IS 'REQUESTED, PENDING_APPROVAL, APPROVED, PROCESSING, COMPLETED, REJECTED, CANCELLED, FAILED';
COMMENT ON COLUMN refunds.refund_method IS 'How refund is issued: ORIGINAL_PAYMENT_METHOD, CREDIT_CARD, BANK_TRANSFER, CASH, CHECK, STORE_CREDIT, OTHER';
COMMENT ON COLUMN refunds.net_refund_amount IS 'Refund amount minus processing fees';
COMMENT ON COLUMN refunds.reason_category IS 'High-level reason: CANCELLATION, NO_SHOW, EARLY_DEPARTURE, SERVICE_ISSUE, OVERCHARGE, etc.';
COMMENT ON COLUMN refunds.requires_approval IS 'TRUE if manager approval needed before processing';
COMMENT ON COLUMN refunds.is_chargeback IS 'TRUE if initiated by credit card chargeback';
COMMENT ON COLUMN refunds.is_full_refund IS 'TRUE if refunding 100% of original payment';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_refunds_tenant ON refunds(tenant_id, property_id, requested_at DESC);
-- CREATE INDEX idx_refunds_reservation ON refunds(reservation_id, refund_status);
-- CREATE INDEX idx_refunds_guest ON refunds(guest_id, requested_at DESC);
-- Create partial unique index for active refund numbers
CREATE UNIQUE INDEX idx_uk_refunds_number
    ON refunds(tenant_id, property_id, refund_number)
    WHERE deleted_at IS NULL;

-- CREATE INDEX idx_refunds_status ON refunds(property_id, refund_status, requested_at DESC);
-- CREATE INDEX idx_refunds_approval ON refunds(property_id, requires_approval) WHERE requires_approval = TRUE AND refund_status = 'PENDING_APPROVAL';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON refunds TO tartware_app;

-- Success message
\echo '✓ Table created: refunds (35/37)'
\echo '  - Refund management'
\echo '  - Approval workflow'
\echo '  - Chargeback tracking'
\echo ''
