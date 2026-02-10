-- =====================================================
-- Financial Closures Table
-- =====================================================
-- Purpose: Manage financial period closures and reconciliations
-- Key Features:
--   - Daily, monthly, annual closures
--   - Reconciliation tracking
--   - Variance analysis
--   - Audit trails
-- =====================================================

CREATE TABLE IF NOT EXISTS financial_closures (
    -- Primary Key
    closure_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Closure Identification
    closure_number VARCHAR(100) UNIQUE NOT NULL,
    closure_name VARCHAR(255) NOT NULL,

    -- Closure Type & Period
    closure_type VARCHAR(50) NOT NULL CHECK (closure_type IN (
        'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'
    )),

    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    fiscal_year INTEGER,
    fiscal_month INTEGER CHECK (fiscal_month BETWEEN 1 AND 12),
    fiscal_quarter INTEGER CHECK (fiscal_quarter BETWEEN 1 AND 4),
    fiscal_week INTEGER CHECK (fiscal_week BETWEEN 1 AND 53),

    business_date DATE NOT NULL,

    -- Status
    closure_status VARCHAR(50) DEFAULT 'in_progress' CHECK (closure_status IN (
        'not_started', 'in_progress', 'pending_review',
        'under_review', 'approved', 'closed', 'reopened', 'cancelled'
    )),

    is_closed BOOLEAN DEFAULT FALSE,
    is_final BOOLEAN DEFAULT FALSE,

    -- Timing
    closure_started_at TIMESTAMP WITH TIME ZONE,
    closure_completed_at TIMESTAMP WITH TIME ZONE,
    closure_duration_minutes INTEGER,

    -- Financial Totals - Revenue
    total_room_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_food_beverage_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_service_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_other_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_gross_revenue DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    -- Deductions
    total_discounts DECIMAL(12,2) DEFAULT 0.00,
    total_refunds DECIMAL(12,2) DEFAULT 0.00,
    total_adjustments DECIMAL(12,2) DEFAULT 0.00,
    total_net_revenue DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    -- Taxes
    total_taxes DECIMAL(12,2) DEFAULT 0.00,
    total_service_charges DECIMAL(12,2) DEFAULT 0.00,

    -- Payments Received
    total_cash_payments DECIMAL(12,2) DEFAULT 0.00,
    total_card_payments DECIMAL(12,2) DEFAULT 0.00,
    total_bank_transfer_payments DECIMAL(12,2) DEFAULT 0.00,
    total_other_payments DECIMAL(12,2) DEFAULT 0.00,
    total_payments_received DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    -- Outstanding
    accounts_receivable DECIMAL(12,2) DEFAULT 0.00,
    deposits_held DECIMAL(12,2) DEFAULT 0.00,
    prepayments DECIMAL(12,2) DEFAULT 0.00,

    -- Counts
    total_reservations INTEGER DEFAULT 0,
    total_checkins INTEGER DEFAULT 0,
    total_checkouts INTEGER DEFAULT 0,
    total_cancellations INTEGER DEFAULT 0,
    total_no_shows INTEGER DEFAULT 0,

    total_transactions INTEGER DEFAULT 0,
    total_invoices INTEGER DEFAULT 0,
    total_payments INTEGER DEFAULT 0,
    total_refund_transactions INTEGER DEFAULT 0,

    -- Occupancy Metrics
    available_rooms INTEGER DEFAULT 0,
    occupied_rooms INTEGER DEFAULT 0,
    out_of_order_rooms INTEGER DEFAULT 0,
    occupancy_percent DECIMAL(5,2),

    adr DECIMAL(10,2), -- Average Daily Rate
    revpar DECIMAL(10,2), -- Revenue Per Available Room

    -- Reconciliation
    requires_reconciliation BOOLEAN DEFAULT TRUE,
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciliation_status VARCHAR(50) CHECK (reconciliation_status IN (
        'pending', 'in_progress', 'completed', 'failed', 'needs_review'
    )),

    -- Expected vs Actual
    expected_cash DECIMAL(12,2),
    actual_cash DECIMAL(12,2),
    cash_variance DECIMAL(12,2),
    cash_variance_percent DECIMAL(5,2),

    expected_card_amount DECIMAL(12,2),
    actual_card_amount DECIMAL(12,2),
    card_variance DECIMAL(12,2),

    expected_total DECIMAL(12,2),
    actual_total DECIMAL(12,2),
    total_variance DECIMAL(12,2),
    variance_percent DECIMAL(5,2),

    -- Variance Flags
    has_variances BOOLEAN DEFAULT FALSE,
    has_material_variances BOOLEAN DEFAULT FALSE,
    variance_threshold_amount DECIMAL(10,2) DEFAULT 10.00,
    variance_threshold_percent DECIMAL(5,2) DEFAULT 1.00,

    -- Variance Analysis
    variance_reasons TEXT,
    variance_details JSONB, -- [{type, expected, actual, variance, reason}]

    -- Bank Reconciliation
    bank_deposit_amount DECIMAL(12,2),
    bank_deposit_date DATE,
    bank_deposit_reference VARCHAR(100),
    bank_reconciled BOOLEAN DEFAULT FALSE,

    -- Till/Cashier Sessions
    total_till_sessions INTEGER DEFAULT 0,
    till_sessions_closed INTEGER DEFAULT 0,
    till_sessions_reconciled INTEGER DEFAULT 0,

    -- Outstanding Items
    unposted_charges_count INTEGER DEFAULT 0,
    unposted_charges_amount DECIMAL(12,2) DEFAULT 0.00,

    pending_payments_count INTEGER DEFAULT 0,
    pending_payments_amount DECIMAL(12,2) DEFAULT 0.00,

    unapplied_deposits_count INTEGER DEFAULT 0,
    unapplied_deposits_amount DECIMAL(12,2) DEFAULT 0.00,

    -- Exceptions & Issues
    has_exceptions BOOLEAN DEFAULT FALSE,
    exception_count INTEGER DEFAULT 0,
    exceptions JSONB, -- [{type, description, amount, resolved}]

    -- Adjustments Made
    adjustment_count INTEGER DEFAULT 0,
    adjustments JSONB, -- [{type, amount, reason, made_by, timestamp}]

    -- General Ledger
    gl_posted BOOLEAN DEFAULT FALSE,
    gl_posted_at TIMESTAMP WITH TIME ZONE,
    gl_posted_by UUID,
    gl_batch_number VARCHAR(100),

    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT TRUE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Review
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    -- Manager Verification
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,

    -- Auditor Review
    auditor_reviewed BOOLEAN DEFAULT FALSE,
    audited_by UUID,
    audited_at TIMESTAMP WITH TIME ZONE,
    audit_findings TEXT,

    -- Reports Generated
    reports_generated BOOLEAN DEFAULT FALSE,
    report_urls TEXT[],

    -- Email Notifications
    notifications_sent BOOLEAN DEFAULT FALSE,
    notification_recipients VARCHAR(255)[],

    -- Previous Period Comparison
    previous_closure_id UUID,
    revenue_growth_percent DECIMAL(5,2),
    occupancy_change_percent DECIMAL(5,2),

    -- Reopening
    can_reopen BOOLEAN DEFAULT FALSE,
    reopened BOOLEAN DEFAULT FALSE,
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopened_by UUID,
    reopening_reason TEXT,

    reopen_count INTEGER DEFAULT 0,
    last_reopened_at TIMESTAMP WITH TIME ZONE,

    -- Lock Period
    period_locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by UUID,
    unlock_requires_authorization BOOLEAN DEFAULT TRUE,

    -- Checklist
    checklist_items JSONB, -- [{item, completed, completed_by, timestamp}]
    checklist_completed BOOLEAN DEFAULT FALSE,

    -- System Flags
    auto_closed BOOLEAN DEFAULT FALSE,
    manual_intervention_required BOOLEAN DEFAULT FALSE,

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
COMMENT ON TABLE financial_closures IS 'Manages financial period closures, reconciliations, and variance analysis';
COMMENT ON COLUMN financial_closures.closure_type IS 'Type of closure: daily, weekly, monthly, quarterly, annual, custom';
COMMENT ON COLUMN financial_closures.variance_details IS 'JSON array of variance analysis: [{type, expected, actual, variance, reason}]';
COMMENT ON COLUMN financial_closures.period_locked IS 'Whether the financial period is locked from further modifications';

\echo 'financial_closures table created successfully!'
