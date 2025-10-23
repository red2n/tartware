-- =====================================================
-- Credit Limits Table
-- =====================================================
-- Purpose: Manage customer credit limits and authorization
-- Key Features:
--   - Credit limit tracking
--   - Utilization monitoring
--   - Temporary increases
--   - Risk assessment
-- =====================================================

CREATE TABLE IF NOT EXISTS credit_limits (
    -- Primary Key
    credit_limit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Account
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN (
        'guest', 'corporate', 'travel_agent', 'group',
        'direct_bill', 'wholesaler', 'government', 'other'
    )),

    account_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_code VARCHAR(100),

    -- Customer References
    guest_id UUID,
    company_id UUID,

    -- Credit Limit
    credit_limit_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status
    credit_status VARCHAR(50) DEFAULT 'active' CHECK (credit_status IN (
        'pending', 'active', 'suspended', 'blocked',
        'under_review', 'expired', 'revoked', 'cancelled'
    )),

    is_active BOOLEAN DEFAULT TRUE,

    -- Effective Dates
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Utilization
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    available_credit DECIMAL(12,2),
    credit_utilization_percent DECIMAL(5,2),

    -- Thresholds
    warning_threshold_percent DECIMAL(5,2) DEFAULT 80.00,
    warning_threshold_reached BOOLEAN DEFAULT FALSE,

    block_threshold_percent DECIMAL(5,2) DEFAULT 95.00,
    block_threshold_reached BOOLEAN DEFAULT FALSE,

    -- Temporary Increase
    temporary_increase_allowed BOOLEAN DEFAULT FALSE,
    temporary_increase_amount DECIMAL(12,2),
    temporary_increase_expires DATE,
    temporary_increase_active BOOLEAN DEFAULT FALSE,
    temporary_increase_reason TEXT,
    temporary_increase_approved_by UUID,

    -- Historical Limits
    previous_limit DECIMAL(12,2),
    limit_increased_count INTEGER DEFAULT 0,
    limit_decreased_count INTEGER DEFAULT 0,
    last_limit_change_date DATE,
    last_limit_change_reason TEXT,

    limit_history JSONB, -- [{date, old_limit, new_limit, reason, changed_by}]

    -- Payment Terms
    payment_terms VARCHAR(100) CHECK (payment_terms IN (
        'due_on_receipt', 'net_15', 'net_30', 'net_45',
        'net_60', 'net_90', 'custom'
    )),
    payment_terms_days INTEGER DEFAULT 30,

    -- Risk Assessment
    risk_level VARCHAR(50) CHECK (risk_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    credit_score INTEGER,

    -- Credit Check
    credit_check_performed BOOLEAN DEFAULT FALSE,
    credit_check_date DATE,
    credit_check_agency VARCHAR(255),
    credit_check_reference VARCHAR(100),
    credit_check_valid_until DATE,

    -- Financial Information
    annual_revenue DECIMAL(15,2),
    years_in_business INTEGER,
    duns_number VARCHAR(50),
    tax_id VARCHAR(100),

    -- References
    trade_references_count INTEGER DEFAULT 0,
    trade_references JSONB, -- [{company, contact, phone, relationship}]

    bank_references_count INTEGER DEFAULT 0,
    bank_references JSONB, -- [{bank_name, account_type, years, contact}]

    -- Guarantees
    has_guarantee BOOLEAN DEFAULT FALSE,
    guarantee_type VARCHAR(100) CHECK (guarantee_type IN (
        'personal', 'corporate', 'bank', 'letter_of_credit',
        'deposit', 'credit_card', 'other'
    )),
    guarantor_name VARCHAR(255),
    guarantor_contact VARCHAR(255),
    guarantee_amount DECIMAL(12,2),
    guarantee_expiry_date DATE,

    -- Security Deposit
    security_deposit_required BOOLEAN DEFAULT FALSE,
    security_deposit_amount DECIMAL(12,2),
    security_deposit_held DECIMAL(12,2),
    security_deposit_refundable BOOLEAN DEFAULT TRUE,

    -- Credit Card on File
    credit_card_on_file BOOLEAN DEFAULT FALSE,
    credit_card_token VARCHAR(255),
    credit_card_last_four VARCHAR(4),
    credit_card_expiry_date DATE,

    -- Payment History
    total_transactions INTEGER DEFAULT 0,
    total_amount_transacted DECIMAL(15,2) DEFAULT 0.00,

    on_time_payment_count INTEGER DEFAULT 0,
    late_payment_count INTEGER DEFAULT 0,
    on_time_payment_percent DECIMAL(5,2),

    average_days_to_pay DECIMAL(5,2),
    longest_overdue_days INTEGER DEFAULT 0,

    last_transaction_date DATE,
    last_payment_date DATE,

    -- Outstanding
    current_outstanding DECIMAL(12,2) DEFAULT 0.00,
    overdue_amount DECIMAL(12,2) DEFAULT 0.00,
    longest_outstanding_days INTEGER DEFAULT 0,

    -- Violations
    limit_exceeded_count INTEGER DEFAULT 0,
    last_limit_exceeded_date DATE,

    -- Credit Review
    requires_review BOOLEAN DEFAULT FALSE,
    review_frequency_days INTEGER DEFAULT 365,
    last_review_date DATE,
    next_review_date DATE,
    reviewed_by UUID,
    review_notes TEXT,

    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT TRUE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    approval_level VARCHAR(50) CHECK (approval_level IN (
        'manager', 'director', 'vp', 'cfo', 'ceo', 'board'
    )),

    -- Suspension/Block
    suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    suspended_at TIMESTAMP WITH TIME ZONE,
    suspended_by UUID,

    blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE,
    blocked_by UUID,

    -- Alerts
    alert_enabled BOOLEAN DEFAULT TRUE,
    alert_threshold_percent DECIMAL(5,2) DEFAULT 80.00,
    alert_recipients VARCHAR(255)[],

    last_alert_sent_at TIMESTAMP WITH TIME ZONE,
    alert_count INTEGER DEFAULT 0,

    -- Restrictions
    restrictions TEXT,
    requires_prepayment BOOLEAN DEFAULT FALSE,
    max_transaction_amount DECIMAL(12,2),
    allowed_services VARCHAR(100)[],
    restricted_services VARCHAR(100)[],

    -- Documents
    has_documentation BOOLEAN DEFAULT FALSE,
    documentation_urls TEXT[],
    credit_application_url TEXT,
    signed_agreement_url TEXT,

    -- Contact
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_contact_phone VARCHAR(50),
    billing_address TEXT,

    -- Relationship
    relationship_start_date DATE,
    customer_since_years INTEGER,
    relationship_manager_id UUID,

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
COMMENT ON TABLE credit_limits IS 'Manages customer credit limits, utilization, risk assessment, and authorization';
COMMENT ON COLUMN credit_limits.available_credit IS 'Calculated as credit_limit_amount - current_balance (including temporary increases)';
COMMENT ON COLUMN credit_limits.limit_history IS 'JSON array of historical limit changes: [{date, old_limit, new_limit, reason, changed_by}]';
COMMENT ON COLUMN credit_limits.temporary_increase_amount IS 'Additional credit available for temporary period';
