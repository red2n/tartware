-- =====================================================
-- Accounts Receivable Table
-- =====================================================
-- Purpose: Manage accounts receivable and aging
-- Key Features:
--   - AR tracking and aging
--   - Payment application
--   - Collection management
--   - Write-off tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS accounts_receivable (
    -- Primary Key
    ar_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- AR Identification
    ar_number VARCHAR(100) UNIQUE NOT NULL,
    ar_reference VARCHAR(255),

    -- Account
    account_type VARCHAR(50) CHECK (account_type IN (
        'guest', 'corporate', 'travel_agent', 'group',
        'direct_bill', 'city_ledger', 'other'
    )),

    account_id UUID,
    account_name VARCHAR(255) NOT NULL,
    account_code VARCHAR(100),

    -- Customer References
    guest_id UUID,
    company_id UUID,

    -- Contact Information
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    billing_address TEXT,

    -- Source Transaction
    source_type VARCHAR(50) CHECK (source_type IN (
        'reservation', 'invoice', 'folio', 'service',
        'charge', 'late_fee', 'adjustment', 'other'
    )),
    source_id UUID,
    source_reference VARCHAR(100),

    reservation_id UUID,
    invoice_id UUID,
    folio_id UUID,

    -- Transaction Details
    transaction_date DATE NOT NULL,
    due_date DATE NOT NULL,

    -- Amount
    original_amount DECIMAL(12,2) NOT NULL,
    outstanding_balance DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0.00,

    currency VARCHAR(3) DEFAULT 'USD',

    -- Status
    ar_status VARCHAR(50) DEFAULT 'open' CHECK (ar_status IN (
        'open', 'partial', 'paid', 'overdue',
        'in_collection', 'written_off', 'disputed', 'cancelled'
    )),

    is_overdue BOOLEAN DEFAULT FALSE,
    days_overdue INTEGER DEFAULT 0,

    -- Aging
    aging_bucket VARCHAR(50) CHECK (aging_bucket IN (
        'current', '1_30_days', '31_60_days', '61_90_days',
        '91_120_days', 'over_120_days'
    )),
    aging_days INTEGER DEFAULT 0,

    -- Payment Terms
    payment_terms VARCHAR(100) CHECK (payment_terms IN (
        'due_on_receipt', 'net_15', 'net_30', 'net_45',
        'net_60', 'net_90', 'custom'
    )),
    payment_terms_days INTEGER DEFAULT 30,

    -- Discount
    early_payment_discount_percent DECIMAL(5,2),
    early_payment_discount_days INTEGER,
    discount_deadline DATE,

    discount_amount DECIMAL(10,2),
    discount_applied BOOLEAN DEFAULT FALSE,

    -- Late Fees
    late_fee_applicable BOOLEAN DEFAULT FALSE,
    late_fee_percent DECIMAL(5,2),
    late_fee_fixed_amount DECIMAL(10,2),
    late_fees_charged DECIMAL(10,2) DEFAULT 0.00,

    -- Interest
    interest_applicable BOOLEAN DEFAULT FALSE,
    interest_rate_percent DECIMAL(5,2),
    interest_accrued DECIMAL(10,2) DEFAULT 0.00,
    last_interest_calculation_date DATE,

    -- Payment History
    payment_count INTEGER DEFAULT 0,
    last_payment_date DATE,
    last_payment_amount DECIMAL(12,2),

    payments JSONB, -- [{date, amount, method, reference}]

    -- Partial Payments
    allows_partial_payment BOOLEAN DEFAULT TRUE,
    minimum_payment_amount DECIMAL(10,2),

    -- Collection
    in_collection BOOLEAN DEFAULT FALSE,
    collection_started_date DATE,
    collection_agency VARCHAR(255),
    collection_agent_id UUID,
    collection_fee_percent DECIMAL(5,2),
    collection_notes TEXT,

    -- Communication
    statement_sent_count INTEGER DEFAULT 0,
    last_statement_sent_date DATE,

    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent_date DATE,
    next_reminder_date DATE,

    demand_letter_sent BOOLEAN DEFAULT FALSE,
    demand_letter_sent_date DATE,

    -- Dispute
    disputed BOOLEAN DEFAULT FALSE,
    dispute_reason TEXT,
    dispute_amount DECIMAL(10,2),
    dispute_filed_date DATE,
    dispute_resolved BOOLEAN DEFAULT FALSE,
    dispute_resolution TEXT,

    -- Write-Off
    written_off BOOLEAN DEFAULT FALSE,
    write_off_amount DECIMAL(12,2),
    write_off_reason TEXT,
    write_off_date DATE,
    written_off_by UUID,
    write_off_approved_by UUID,

    -- Bad Debt
    is_bad_debt BOOLEAN DEFAULT FALSE,
    bad_debt_reserve DECIMAL(10,2),

    -- Adjustment
    has_adjustments BOOLEAN DEFAULT FALSE,
    adjustment_amount DECIMAL(12,2) DEFAULT 0.00,
    adjustments JSONB, -- [{date, amount, reason, approved_by}]

    -- Credit Memo
    credit_memo_applied BOOLEAN DEFAULT FALSE,
    credit_memo_amount DECIMAL(10,2),
    credit_memo_ids UUID[],

    -- Payment Plan
    has_payment_plan BOOLEAN DEFAULT FALSE,
    payment_plan_id UUID,
    installment_count INTEGER,
    installment_amount DECIMAL(10,2),
    next_installment_due_date DATE,

    -- Guarantor
    has_guarantor BOOLEAN DEFAULT FALSE,
    guarantor_name VARCHAR(255),
    guarantor_contact VARCHAR(255),
    guarantor_liable_amount DECIMAL(12,2),

    -- Legal Action
    legal_action_taken BOOLEAN DEFAULT FALSE,
    legal_action_date DATE,
    legal_action_type VARCHAR(100),
    legal_case_number VARCHAR(100),
    legal_notes TEXT,

    -- Settlement
    settlement_offered BOOLEAN DEFAULT FALSE,
    settlement_amount DECIMAL(12,2),
    settlement_accepted BOOLEAN DEFAULT FALSE,
    settlement_date DATE,

    -- Priority
    priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    collection_probability_percent DECIMAL(5,2),

    -- Responsible Staff
    account_manager_id UUID,
    collection_manager_id UUID,

    -- Alerts
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_level VARCHAR(50),
    next_action_date DATE,
    next_action_type VARCHAR(100),

    -- GL Posting
    gl_posted BOOLEAN DEFAULT FALSE,
    gl_posted_at TIMESTAMP WITH TIME ZONE,
    gl_account VARCHAR(100),

    -- Reconciliation
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciled_by UUID,

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

-- Indexes for accounts_receivable
CREATE INDEX idx_accounts_receivable_tenant ON accounts_receivable(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_property ON accounts_receivable(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_number ON accounts_receivable(ar_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_account ON accounts_receivable(account_type, account_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_guest ON accounts_receivable(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_company ON accounts_receivable(company_id) WHERE company_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_source ON accounts_receivable(source_type, source_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_reservation ON accounts_receivable(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_invoice ON accounts_receivable(invoice_id) WHERE invoice_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_status ON accounts_receivable(ar_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_overdue ON accounts_receivable(is_overdue, days_overdue) WHERE is_overdue = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_aging ON accounts_receivable(aging_bucket, outstanding_balance DESC) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_due_date ON accounts_receivable(due_date) WHERE ar_status IN ('open', 'partial') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_collection ON accounts_receivable(in_collection, collection_started_date) WHERE in_collection = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_disputed ON accounts_receivable(disputed, dispute_resolved) WHERE disputed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_written_off ON accounts_receivable(written_off, write_off_date) WHERE written_off = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_payment_plan ON accounts_receivable(has_payment_plan, next_installment_due_date) WHERE has_payment_plan = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_legal ON accounts_receivable(legal_action_taken) WHERE legal_action_taken = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_priority ON accounts_receivable(priority, outstanding_balance DESC) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_manager ON accounts_receivable(account_manager_id, ar_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_gl_posted ON accounts_receivable(gl_posted) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_metadata ON accounts_receivable USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_tags ON accounts_receivable USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_accounts_receivable_property_overdue ON accounts_receivable(property_id, is_overdue, due_date) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_property_aging ON accounts_receivable(property_id, aging_bucket, outstanding_balance DESC) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_property_collection ON accounts_receivable(property_id, in_collection, outstanding_balance DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_outstanding ON accounts_receivable(property_id, ar_status, outstanding_balance DESC) WHERE ar_status IN ('open', 'partial', 'overdue') AND is_deleted = FALSE;

-- Comments
COMMENT ON TABLE accounts_receivable IS 'Manages accounts receivable, aging, collections, and write-offs';
COMMENT ON COLUMN accounts_receivable.aging_bucket IS 'Aging category: current, 1_30_days, 31_60_days, 61_90_days, 91_120_days, over_120_days';
COMMENT ON COLUMN accounts_receivable.payments IS 'JSON array of payment history: [{date, amount, method, reference}]';
COMMENT ON COLUMN accounts_receivable.write_off_amount IS 'Amount written off as bad debt';
