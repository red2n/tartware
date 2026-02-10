-- =====================================================
-- Cashier Sessions Table
-- =====================================================
-- Purpose: Manage cashier/till sessions and cash handling
-- Key Features:
--   - Session open/close tracking
--   - Cash reconciliation
--   - Payment method breakdown
--   - Variance management
-- =====================================================

CREATE TABLE IF NOT EXISTS cashier_sessions (
    -- Primary Key
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Session Identification
    session_number VARCHAR(100) UNIQUE NOT NULL,
    session_name VARCHAR(255),

    -- Cashier/User
    cashier_id UUID NOT NULL,
    cashier_name VARCHAR(255),

    -- Terminal/Till
    terminal_id VARCHAR(100),
    terminal_name VARCHAR(255),
    till_id VARCHAR(100),
    register_id VARCHAR(100),
    location VARCHAR(255),

    -- Session Status
    session_status VARCHAR(50) DEFAULT 'open' CHECK (session_status IN (
        'open', 'suspended', 'closed', 'reconciled', 'audited', 'disputed', 'cancelled'
    )),

    -- Session Timing
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    session_duration_minutes INTEGER,

    business_date DATE NOT NULL,
    shift_type VARCHAR(50) CHECK (shift_type IN ('morning', 'afternoon', 'evening', 'night', 'full_day', 'custom')),

    -- Opening Float
    opening_float_declared DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    opening_float_counted DECIMAL(12,2),
    opening_float_variance DECIMAL(10,2),

    -- Currency
    base_currency VARCHAR(3) DEFAULT 'USD',
    multi_currency_enabled BOOLEAN DEFAULT FALSE,

    -- Transaction Counts
    total_transactions INTEGER DEFAULT 0,
    cash_transactions INTEGER DEFAULT 0,
    card_transactions INTEGER DEFAULT 0,
    other_transactions INTEGER DEFAULT 0,

    refund_transactions INTEGER DEFAULT 0,
    void_transactions INTEGER DEFAULT 0,

    -- Revenue by Payment Method
    total_cash_received DECIMAL(12,2) DEFAULT 0.00,
    total_card_received DECIMAL(12,2) DEFAULT 0.00,
    total_bank_transfer DECIMAL(12,2) DEFAULT 0.00,
    total_mobile_payment DECIMAL(12,2) DEFAULT 0.00,
    total_other_payments DECIMAL(12,2) DEFAULT 0.00,

    -- Total Revenue
    total_revenue DECIMAL(12,2) DEFAULT 0.00,

    -- Refunds/Returns
    total_refunds DECIMAL(12,2) DEFAULT 0.00,
    cash_refunds DECIMAL(12,2) DEFAULT 0.00,
    card_refunds DECIMAL(12,2) DEFAULT 0.00,

    -- Voids/Corrections
    total_voids DECIMAL(12,2) DEFAULT 0.00,
    void_count INTEGER DEFAULT 0,

    -- Net Revenue
    net_revenue DECIMAL(12,2) DEFAULT 0.00,

    -- Cash Management
    cash_in DECIMAL(12,2) DEFAULT 0.00,
    cash_out DECIMAL(12,2) DEFAULT 0.00,

    cash_deposits INTEGER DEFAULT 0,
    cash_deposits_amount DECIMAL(12,2) DEFAULT 0.00,

    cash_withdrawals INTEGER DEFAULT 0,
    cash_withdrawals_amount DECIMAL(12,2) DEFAULT 0.00,

    -- Expected Closing Balance
    expected_cash_balance DECIMAL(12,2),
    expected_total_balance DECIMAL(12,2),

    -- Actual Closing Count
    closing_cash_declared DECIMAL(12,2),
    closing_cash_counted DECIMAL(12,2),
    closing_total_counted DECIMAL(12,2),

    -- Cash Breakdown (Denominations)
    cash_breakdown JSONB, -- [{denomination, count, amount}]

    -- Variance
    cash_variance DECIMAL(12,2),
    cash_variance_percent DECIMAL(5,2),

    total_variance DECIMAL(12,2),
    variance_reason TEXT,

    has_variance BOOLEAN DEFAULT FALSE,
    has_material_variance BOOLEAN DEFAULT FALSE,
    variance_threshold DECIMAL(10,2) DEFAULT 10.00,

    -- Card Payments Detail
    card_payment_breakdown JSONB, -- [{card_type, count, amount, fees}]
    card_processing_fees DECIMAL(10,2) DEFAULT 0.00,

    -- Bank Deposit
    bank_deposit_prepared BOOLEAN DEFAULT FALSE,
    bank_deposit_amount DECIMAL(12,2),
    bank_deposit_date DATE,
    bank_deposit_slip_number VARCHAR(100),
    bank_deposited BOOLEAN DEFAULT FALSE,

    -- Reconciliation
    requires_reconciliation BOOLEAN DEFAULT TRUE,
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciled_by UUID,
    reconciliation_notes TEXT,

    -- Adjustments
    has_adjustments BOOLEAN DEFAULT FALSE,
    adjustment_count INTEGER DEFAULT 0,
    adjustment_amount DECIMAL(12,2) DEFAULT 0.00,
    adjustments JSONB, -- [{type, amount, reason, authorized_by}]

    -- Exceptions
    has_exceptions BOOLEAN DEFAULT FALSE,
    exception_count INTEGER DEFAULT 0,
    exceptions JSONB, -- [{type, description, amount, timestamp}]

    -- Supervisor Actions
    supervisor_override_count INTEGER DEFAULT 0,
    supervisor_overrides JSONB, -- [{reason, amount, timestamp, supervisor_id}]

    -- Audit Trail
    last_audit_at TIMESTAMP WITH TIME ZONE,
    audited_by UUID,
    audit_findings TEXT,

    -- Approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Manager Review
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    -- Discrepancy Investigation
    has_discrepancy BOOLEAN DEFAULT FALSE,
    discrepancy_investigated BOOLEAN DEFAULT FALSE,
    investigation_notes TEXT,
    investigated_by UUID,

    -- Payment Method Details
    payment_methods_summary JSONB, -- [{method, count, amount, fees}]

    -- Currency Exchange (if multi-currency)
    foreign_currency_transactions INTEGER DEFAULT 0,
    exchange_rates JSONB, -- [{currency, rate, amount_received, amount_local}]

    -- Petty Cash
    petty_cash_transactions INTEGER DEFAULT 0,
    petty_cash_out DECIMAL(10,2) DEFAULT 0.00,

    -- Tips
    tips_collected DECIMAL(10,2) DEFAULT 0.00,
    tips_distributed DECIMAL(10,2) DEFAULT 0.00,
    tips_outstanding DECIMAL(10,2) DEFAULT 0.00,

    -- Coupons/Vouchers
    vouchers_redeemed INTEGER DEFAULT 0,
    vouchers_amount DECIMAL(10,2) DEFAULT 0.00,

    -- Gift Cards
    gift_cards_sold INTEGER DEFAULT 0,
    gift_cards_sold_amount DECIMAL(10,2) DEFAULT 0.00,
    gift_cards_redeemed INTEGER DEFAULT 0,
    gift_cards_redeemed_amount DECIMAL(10,2) DEFAULT 0.00,

    -- Revenue Categories
    room_revenue DECIMAL(12,2) DEFAULT 0.00,
    food_beverage_revenue DECIMAL(12,2) DEFAULT 0.00,
    service_revenue DECIMAL(12,2) DEFAULT 0.00,
    other_revenue DECIMAL(12,2) DEFAULT 0.00,

    -- Taxes Collected
    taxes_collected DECIMAL(12,2) DEFAULT 0.00,

    -- Reports
    reports_generated BOOLEAN DEFAULT FALSE,
    report_urls TEXT[],

    -- Related Sessions
    previous_session_id UUID,
    next_session_id UUID,

    -- Metadata
    metadata JSONB,
    notes TEXT,
    internal_notes TEXT,
    tags VARCHAR(100)[],

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


-- Comments
COMMENT ON TABLE cashier_sessions IS 'Manages cashier/till sessions with cash handling and reconciliation';
COMMENT ON COLUMN cashier_sessions.cash_breakdown IS 'JSON array of cash denominations: [{denomination, count, amount}]';
COMMENT ON COLUMN cashier_sessions.payment_methods_summary IS 'JSON summary of all payment methods: [{method, count, amount, fees}]';
COMMENT ON COLUMN cashier_sessions.has_material_variance IS 'Whether variance exceeds threshold requiring investigation';

\echo 'cashier_sessions table created successfully!'
