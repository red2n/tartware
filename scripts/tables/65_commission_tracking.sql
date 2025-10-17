-- =====================================================
-- Commission Tracking Table
-- =====================================================
-- Purpose: Track sales commissions for staff, agents, and channels
-- Key Features:
--   - Multi-tier commission structures
--   - Performance-based calculations
--   - Payout tracking
--   - Dispute resolution
-- =====================================================

CREATE TABLE IF NOT EXISTS commission_tracking (
    -- Primary Key
    commission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Commission Identification
    commission_number VARCHAR(100) UNIQUE NOT NULL,

    -- Commission Type
    commission_type VARCHAR(100) NOT NULL CHECK (commission_type IN (
        'sales', 'booking', 'ota', 'travel_agent', 'corporate',
        'referral', 'staff', 'manager', 'group', 'event', 'other'
    )),

    -- Beneficiary
    beneficiary_type VARCHAR(50) CHECK (beneficiary_type IN (
        'staff', 'user', 'agent', 'ota', 'channel', 'corporate_account', 'affiliate', 'other'
    )),
    beneficiary_id UUID,
    beneficiary_name VARCHAR(255),

    staff_id UUID,
    agent_id UUID,
    channel_id UUID,

    -- Source Transaction
    source_type VARCHAR(50) CHECK (source_type IN (
        'reservation', 'booking', 'payment', 'invoice', 'service', 'package', 'event', 'other'
    )),
    source_id UUID NOT NULL,
    source_reference VARCHAR(100),

    reservation_id UUID,
    booking_id UUID,
    invoice_id UUID,
    payment_id UUID,

    -- Transaction Details
    transaction_date DATE NOT NULL,
    check_in_date DATE,
    check_out_date DATE,

    guest_id UUID,
    guest_name VARCHAR(255),

    -- Commission Base
    base_amount DECIMAL(12,2) NOT NULL,
    base_currency VARCHAR(3) DEFAULT 'USD',

    -- Calculation
    calculation_method VARCHAR(100) CHECK (calculation_method IN (
        'percentage', 'flat_rate', 'tiered', 'performance_based',
        'volume_based', 'hybrid', 'custom'
    )),

    commission_rate DECIMAL(10,4),
    commission_percent DECIMAL(5,2),
    flat_rate_amount DECIMAL(10,2),

    -- Tiered Commission
    is_tiered BOOLEAN DEFAULT FALSE,
    tier_level INTEGER,
    tier_rate DECIMAL(10,4),
    tier_details JSONB, -- [{min_amount, max_amount, rate}]

    -- Commission Amount
    commission_amount DECIMAL(12,2) NOT NULL,
    commission_currency VARCHAR(3) DEFAULT 'USD',

    -- Tax Handling
    is_taxable BOOLEAN DEFAULT FALSE,
    tax_rate DECIMAL(5,2),
    tax_amount DECIMAL(10,2),
    net_commission_amount DECIMAL(12,2),

    -- Status
    commission_status VARCHAR(50) DEFAULT 'pending' CHECK (commission_status IN (
        'pending', 'calculated', 'approved', 'rejected',
        'on_hold', 'paid', 'partially_paid', 'cancelled', 'disputed'
    )),

    -- Approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Payment Status
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN (
        'unpaid', 'scheduled', 'processing', 'paid',
        'partially_paid', 'failed', 'refunded', 'cancelled'
    )),

    -- Payment Details
    payment_due_date DATE,
    payment_date DATE,
    payment_amount DECIMAL(12,2),
    payment_method VARCHAR(100),
    payment_reference VARCHAR(100),
    payment_batch_id VARCHAR(100),

    paid_by UUID,
    paid_at TIMESTAMP WITH TIME ZONE,

    -- Partial Payments
    partial_payment_count INTEGER DEFAULT 0,
    total_paid DECIMAL(12,2) DEFAULT 0.00,
    outstanding_amount DECIMAL(12,2),

    -- Payment Schedule
    scheduled_payment_date DATE,
    payment_cycle VARCHAR(50) CHECK (payment_cycle IN (
        'immediate', 'weekly', 'bi_weekly', 'monthly',
        'quarterly', 'annual', 'on_demand', 'custom'
    )),

    -- Performance Metrics
    performance_tier VARCHAR(50),
    performance_multiplier DECIMAL(5,2) DEFAULT 1.00,
    bonus_amount DECIMAL(10,2) DEFAULT 0.00,

    -- Volume Bonuses
    volume_tier VARCHAR(50),
    volume_bonus DECIMAL(10,2) DEFAULT 0.00,
    total_volume_ytd DECIMAL(12,2),

    -- Split Commission
    is_split BOOLEAN DEFAULT FALSE,
    split_count INTEGER DEFAULT 1,
    split_percentage DECIMAL(5,2) DEFAULT 100.00,
    primary_commission_id UUID,

    split_recipients JSONB, -- [{recipient_id, name, percentage, amount}]

    -- Clawback/Reversal
    is_reversible BOOLEAN DEFAULT TRUE,
    reversed BOOLEAN DEFAULT FALSE,
    reversal_reason TEXT,
    reversed_at TIMESTAMP WITH TIME ZONE,
    reversed_by UUID,
    original_commission_id UUID,

    -- Chargeback
    chargeback BOOLEAN DEFAULT FALSE,
    chargeback_amount DECIMAL(12,2),
    chargeback_reason TEXT,
    chargeback_date DATE,

    -- Adjustment
    has_adjustments BOOLEAN DEFAULT FALSE,
    adjustment_amount DECIMAL(12,2) DEFAULT 0.00,
    adjustment_reason TEXT,
    adjusted_by UUID,
    adjusted_at TIMESTAMP WITH TIME ZONE,

    -- Dispute
    disputed BOOLEAN DEFAULT FALSE,
    dispute_reason TEXT,
    dispute_filed_at TIMESTAMP WITH TIME ZONE,
    dispute_filed_by UUID,
    dispute_resolved BOOLEAN DEFAULT FALSE,
    dispute_resolution TEXT,
    dispute_resolved_at TIMESTAMP WITH TIME ZONE,

    -- Cap/Limits
    has_cap BOOLEAN DEFAULT FALSE,
    cap_amount DECIMAL(10,2),
    capped BOOLEAN DEFAULT FALSE,
    pre_cap_amount DECIMAL(12,2),

    minimum_commission DECIMAL(10,2),
    maximum_commission DECIMAL(10,2),

    -- Period Tracking
    earning_period_start DATE,
    earning_period_end DATE,
    payment_period VARCHAR(50),

    fiscal_year INTEGER,
    fiscal_month INTEGER,
    fiscal_quarter INTEGER,

    -- Accumulation
    accumulated_ytd DECIMAL(12,2) DEFAULT 0.00,
    accumulated_qtd DECIMAL(12,2) DEFAULT 0.00,
    accumulated_mtd DECIMAL(12,2) DEFAULT 0.00,

    -- Contract/Agreement
    contract_id UUID,
    commission_rule_id UUID,
    rate_card_id UUID,

    -- Documentation
    has_documentation BOOLEAN DEFAULT FALSE,
    documentation_urls TEXT[],

    -- Notifications
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,

    -- Reconciliation
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciled_by UUID,
    reconciliation_notes TEXT,

    -- GL Posting
    gl_posted BOOLEAN DEFAULT FALSE,
    gl_posted_at TIMESTAMP WITH TIME ZONE,
    gl_account VARCHAR(100),

    -- Related Commissions
    parent_commission_id UUID,
    related_commission_ids UUID[],

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

-- Indexes for commission_tracking
CREATE INDEX idx_commission_tracking_tenant ON commission_tracking(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_property ON commission_tracking(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_number ON commission_tracking(commission_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_type ON commission_tracking(commission_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_beneficiary ON commission_tracking(beneficiary_type, beneficiary_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_staff ON commission_tracking(staff_id) WHERE staff_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_agent ON commission_tracking(agent_id) WHERE agent_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_source ON commission_tracking(source_type, source_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_reservation ON commission_tracking(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_status ON commission_tracking(commission_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_payment_status ON commission_tracking(payment_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_payment_due ON commission_tracking(payment_due_date) WHERE payment_status IN ('unpaid', 'scheduled') AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_transaction_date ON commission_tracking(transaction_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_approval ON commission_tracking(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_split ON commission_tracking(is_split, primary_commission_id) WHERE is_split = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_disputed ON commission_tracking(disputed, dispute_resolved) WHERE disputed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_reversed ON commission_tracking(reversed) WHERE reversed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_reconciled ON commission_tracking(reconciled) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_fiscal ON commission_tracking(fiscal_year, fiscal_month) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_gl_posted ON commission_tracking(gl_posted) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_parent ON commission_tracking(parent_commission_id) WHERE parent_commission_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_metadata ON commission_tracking USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_tags ON commission_tracking USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_commission_tracking_staff_unpaid ON commission_tracking(staff_id, payment_status, payment_due_date) WHERE staff_id IS NOT NULL AND payment_status IN ('unpaid', 'scheduled') AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_property_pending ON commission_tracking(property_id, commission_status) WHERE commission_status IN ('pending', 'calculated') AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_beneficiary_period ON commission_tracking(beneficiary_id, fiscal_year, fiscal_month) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_payment_cycle ON commission_tracking(payment_cycle, scheduled_payment_date) WHERE payment_status = 'scheduled' AND is_deleted = FALSE;

-- Comments
COMMENT ON TABLE commission_tracking IS 'Tracks sales commissions for staff, agents, channels with payment and dispute management';
COMMENT ON COLUMN commission_tracking.calculation_method IS 'How commission is calculated: percentage, flat_rate, tiered, performance_based, etc';
COMMENT ON COLUMN commission_tracking.is_split IS 'Whether commission is split between multiple recipients';
COMMENT ON COLUMN commission_tracking.split_recipients IS 'JSON array of split recipients: [{recipient_id, name, percentage, amount}]';
