-- =====================================================
-- 30_deposit_schedules.sql
-- Deposit & Payment Schedules
--
-- Purpose: Track payment schedules and deposit requirements
-- Industry Standard: OPERA (DEPOSIT_SCHEDULE), Cloudbeds (payment_schedules),
--                    Protel (ANZAHLUNGSPLAN), RMS (deposit_policy)
--
-- Use Cases:
-- - Group bookings with multiple payment milestones
-- - Long-term stays with installment payments
-- - Deposit policies (e.g., 30% due at booking)
-- - Balance due tracking
--
-- Helps property managers track expected payments
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS deposit_schedules CASCADE;

CREATE TABLE deposit_schedules (
    -- Primary Key
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Association
    reservation_id UUID NOT NULL,
    guest_id UUID,
    folio_id UUID, -- If payment should be posted to specific folio

    -- Schedule Information
    schedule_number VARCHAR(50), -- Human-readable reference
    schedule_type VARCHAR(30) NOT NULL
        CHECK (schedule_type IN ('DEPOSIT', 'INSTALLMENT', 'BALANCE_DUE', 'PREPAYMENT', 'SECURITY_DEPOSIT')),

    -- Amount Information
    amount_due DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) DEFAULT 0.00,
    amount_remaining DECIMAL(12, 2) NOT NULL,
    currency_code CHAR(3) DEFAULT 'USD',

    -- Calculation Method
    calculation_method VARCHAR(20) DEFAULT 'FIXED'
        CHECK (calculation_method IN ('FIXED', 'PERCENTAGE', 'PER_NIGHT', 'REMAINING_BALANCE')),
    percentage_of_total DECIMAL(5, 2), -- If calculation_method = PERCENTAGE
    number_of_nights INTEGER, -- If calculation_method = PER_NIGHT

    -- Due Information
    due_date DATE NOT NULL,
    due_time TIME, -- Specific time if applicable
    due_offset_days INTEGER, -- Days before/after reference date
    reference_date_type VARCHAR(30), -- BOOKING_DATE, ARRIVAL_DATE, DEPARTURE_DATE

    -- Status
    schedule_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (schedule_status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED')),

    -- Payment Tracking
    first_payment_date DATE,
    last_payment_date DATE,
    paid_at TIMESTAMP,
    paid_by UUID, -- User who recorded payment

    -- Overdue Handling
    is_overdue BOOLEAN DEFAULT FALSE,
    overdue_since DATE,
    overdue_amount DECIMAL(12, 2),
    grace_period_days INTEGER DEFAULT 0,

    -- Notifications
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent_at TIMESTAMP,
    next_reminder_date DATE,

    -- Waiver Information
    is_waived BOOLEAN DEFAULT FALSE,
    waived_amount DECIMAL(12, 2),
    waived_at TIMESTAMP,
    waived_by UUID,
    waiver_reason VARCHAR(500),
    waiver_approved_by UUID,

    -- Policy Information
    policy_code VARCHAR(50), -- Reference to deposit policy
    policy_name VARCHAR(200),
    is_refundable BOOLEAN DEFAULT TRUE,
    refund_deadline DATE,
    cancellation_fee_percent DECIMAL(5, 2),

    -- Enforcement
    is_mandatory BOOLEAN DEFAULT TRUE,
    blocks_check_in BOOLEAN DEFAULT FALSE, -- Must be paid before check-in

    -- Payment Method Restrictions
    allowed_payment_methods TEXT[], -- Array of allowed methods
    preferred_payment_method VARCHAR(50),

    -- Related Payments
    payment_ids UUID[], -- Array of payment IDs that fulfill this schedule

    -- Financial Posting
    is_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    posted_by UUID,
    posting_id UUID, -- Reference to charge_postings if posted

    -- Sequence
    sequence_number INTEGER, -- Order in multi-part payment plan
    total_installments INTEGER, -- Total number of payments in plan

    -- Parent/Child Relationships
    parent_schedule_id UUID, -- For installments of a larger plan

    -- Notes
    notes TEXT,
    internal_notes TEXT,
    guest_instructions TEXT, -- Instructions shown to guest

    -- Metadata
    metadata JSONB,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    -- Amount remaining should match
    CONSTRAINT chk_deposit_schedules_amounts
        CHECK (amount_remaining = amount_due - amount_paid),

    -- Paid status requires paid_at timestamp
    CONSTRAINT chk_deposit_schedules_paid
        CHECK (
            schedule_status != 'PAID' OR
            paid_at IS NOT NULL
        ),

    -- Waived requires waiver info
    CONSTRAINT chk_deposit_schedules_waived
        CHECK (
            is_waived = FALSE OR
            (waived_at IS NOT NULL AND waived_by IS NOT NULL)
        ),

    -- Percentage must be valid
    CONSTRAINT chk_deposit_schedules_percentage
        CHECK (
            percentage_of_total IS NULL OR
            (percentage_of_total >= 0 AND percentage_of_total <= 100)
        )
);

-- Add table comment
COMMENT ON TABLE deposit_schedules IS 'Payment schedules and deposit requirements for reservations. Tracks installments, deposits, and balance due dates.';

-- Add column comments
COMMENT ON COLUMN deposit_schedules.schedule_type IS 'DEPOSIT (initial), INSTALLMENT (payment plan), BALANCE_DUE (final), PREPAYMENT, SECURITY_DEPOSIT';
COMMENT ON COLUMN deposit_schedules.calculation_method IS 'How amount is calculated: FIXED (set amount), PERCENTAGE (% of total), PER_NIGHT (nightly rate), REMAINING_BALANCE';
COMMENT ON COLUMN deposit_schedules.schedule_status IS 'PENDING, PARTIALLY_PAID, PAID, OVERDUE, WAIVED, CANCELLED';
COMMENT ON COLUMN deposit_schedules.due_offset_days IS 'Days before (-) or after (+) reference date. E.g., -30 = 30 days before arrival';
COMMENT ON COLUMN deposit_schedules.blocks_check_in IS 'If TRUE, guest cannot check in until this payment is made';
COMMENT ON COLUMN deposit_schedules.is_refundable IS 'Whether deposit can be refunded upon cancellation';
COMMENT ON COLUMN deposit_schedules.sequence_number IS 'Order in multi-installment payment plan (1, 2, 3, etc.)';
COMMENT ON COLUMN deposit_schedules.parent_schedule_id IS 'Links child installments to parent schedule';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_deposit_schedules_tenant ON deposit_schedules(tenant_id, property_id, due_date);
-- CREATE INDEX idx_deposit_schedules_reservation ON deposit_schedules(reservation_id, sequence_number);
-- Create partial unique index for active schedule numbers
CREATE UNIQUE INDEX idx_uk_deposit_schedules_number
    ON deposit_schedules(tenant_id, property_id, schedule_number)
    WHERE deleted_at IS NULL;

-- CREATE INDEX idx_deposit_schedules_status ON deposit_schedules(property_id, schedule_status, due_date);
-- CREATE INDEX idx_deposit_schedules_overdue ON deposit_schedules(property_id, is_overdue, due_date) WHERE is_overdue = TRUE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON deposit_schedules TO tartware_app;

-- Success message
\echo '✓ Table created: deposit_schedules (30/37)'
\echo '  - Payment schedule tracking'
\echo '  - Deposit policy enforcement'
\echo '  - Installment plans'
\echo ''
\echo '==================================='
\echo '✓ PHASE 1 COMPLETE (6/6 tables)'
\echo '==================================='
\echo ''
