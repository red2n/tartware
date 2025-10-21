-- =============================================
-- Travel Agent Commissions Table
-- =============================================
-- Description: Track and manage travel agent commission calculations and payments
-- Dependencies: companies, reservations, payments
-- Category: Financial Management
-- =============================================

CREATE TABLE IF NOT EXISTS travel_agent_commissions (
    -- Primary Key
    commission_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Agent & Reservation
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE RESTRICT,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,

    -- Commission Period
    commission_period VARCHAR(50) CHECK (commission_period IN (
        'monthly',
        'quarterly',
        'semi_annual',
        'annual',
        'per_booking',
        'on_checkout'
    )),
    period_start_date DATE,
    period_end_date DATE,

    -- Revenue Breakdown
    room_revenue DECIMAL(12,2) DEFAULT 0.00,
    food_revenue DECIMAL(12,2) DEFAULT 0.00,
    beverage_revenue DECIMAL(12,2) DEFAULT 0.00,
    spa_revenue DECIMAL(12,2) DEFAULT 0.00,
    other_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_revenue DECIMAL(12,2) NOT NULL,

    -- Commission Calculation
    commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN (
        'percentage',
        'flat_rate',
        'tiered',
        'graduated',
        'performance_based',
        'net_rate'
    )),

    -- Percentage-based
    room_commission_rate DECIMAL(5,2),
    food_beverage_commission_rate DECIMAL(5,2),
    spa_commission_rate DECIMAL(5,2),
    other_commission_rate DECIMAL(5,2),
    overall_commission_rate DECIMAL(5,2),

    -- Flat rate
    flat_commission_amount DECIMAL(10,2),

    -- Calculated Commission
    room_commission DECIMAL(12,2) DEFAULT 0.00,
    food_beverage_commission DECIMAL(12,2) DEFAULT 0.00,
    spa_commission DECIMAL(12,2) DEFAULT 0.00,
    other_commission DECIMAL(12,2) DEFAULT 0.00,
    gross_commission DECIMAL(12,2) NOT NULL,

    -- Adjustments & Deductions
    adjustment_amount DECIMAL(12,2) DEFAULT 0.00,
    adjustment_reason TEXT,
    tax_deducted DECIMAL(12,2) DEFAULT 0.00,
    withholding_tax_rate DECIMAL(5,2),
    cancellation_deduction DECIMAL(12,2) DEFAULT 0.00,
    chargeback_amount DECIMAL(12,2) DEFAULT 0.00,

    -- Net Commission
    net_commission DECIMAL(12,2) GENERATED ALWAYS AS (
        gross_commission + adjustment_amount - tax_deducted - cancellation_deduction - chargeback_amount
    ) STORED,

    -- Payment Information
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
        'pending',
        'approved',
        'processing',
        'paid',
        'on_hold',
        'disputed',
        'cancelled'
    )),
    payment_method VARCHAR(50) CHECK (payment_method IN (
        'bank_transfer',
        'check',
        'ach',
        'wire',
        'credit_note',
        'offset'
    )),
    payment_date DATE,
    payment_reference VARCHAR(100),
    payment_id UUID REFERENCES payments(id),

    -- Invoice
    invoice_number VARCHAR(50) UNIQUE,
    invoice_date DATE,
    invoice_due_date DATE,
    invoice_url TEXT,

    -- Currency
    currency_code VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,

    -- Performance Tiers (for tiered/graduated commission)
    tier_level INTEGER,
    tier_threshold DECIMAL(12,2),
    bonus_commission DECIMAL(12,2) DEFAULT 0.00,

    -- Booking Details
    booking_date DATE,
    checkin_date DATE,
    checkout_date DATE,
    number_of_nights INTEGER,
    number_of_rooms INTEGER,
    guest_name VARCHAR(255),
    confirmation_number VARCHAR(50),

    -- Agency Details (snapshot at time of commission)
    agency_name VARCHAR(255),
    agency_code VARCHAR(50),
    agent_name VARCHAR(255),
    agent_email VARCHAR(255),
    agent_phone VARCHAR(50),

    -- Tax Documentation
    tax_id_number VARCHAR(50),
    tax_form_type VARCHAR(50), -- '1099', 'W9', etc.
    tax_form_submitted BOOLEAN DEFAULT FALSE,

    -- Statement Information
    statement_number VARCHAR(50),
    statement_date DATE,
    included_in_statement BOOLEAN DEFAULT FALSE,

    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    approval_notes TEXT,

    -- Reconciliation
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_date DATE,
    reconciled_by UUID REFERENCES users(id),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    version BIGINT DEFAULT 0,

    -- Constraints
    CHECK (total_revenue >= 0),
    CHECK (gross_commission >= 0),
    CHECK (net_commission >= 0)
);

-- =============================================
-- Commission Statements Table
-- =============================================

CREATE TABLE IF NOT EXISTS commission_statements (
    -- Primary Key
    statement_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Agent
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE RESTRICT,

    -- Statement Details
    statement_number VARCHAR(50) UNIQUE NOT NULL,
    statement_date DATE NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Summary
    total_bookings INTEGER DEFAULT 0,
    total_room_nights INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_gross_commission DECIMAL(12,2) DEFAULT 0.00,
    total_adjustments DECIMAL(12,2) DEFAULT 0.00,
    total_deductions DECIMAL(12,2) DEFAULT 0.00,
    total_net_commission DECIMAL(12,2) DEFAULT 0.00,

    -- Payment
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
        'pending',
        'approved',
        'paid',
        'on_hold',
        'cancelled'
    )),
    payment_date DATE,
    payment_reference VARCHAR(100),

    -- Documents
    statement_url TEXT,
    supporting_documents TEXT[],

    -- Status
    is_finalized BOOLEAN DEFAULT FALSE,
    finalized_at TIMESTAMP WITHOUT TIME ZONE,
    finalized_by UUID REFERENCES users(id),

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Commission Rules Table
-- =============================================

CREATE TABLE IF NOT EXISTS commission_rules (
    -- Primary Key
    rule_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Agent/Company
    company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
    apply_to_all_agents BOOLEAN DEFAULT FALSE,

    -- Rule Details
    rule_name VARCHAR(255) NOT NULL,
    rule_description TEXT,
    rule_priority INTEGER DEFAULT 0,

    -- Applicability
    applicable_booking_channels TEXT[],
    applicable_room_types UUID[],
    applicable_rate_codes TEXT[],
    applicable_market_segments TEXT[],

    -- Date Range
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Commission Rates
    room_commission_rate DECIMAL(5,2),
    food_beverage_commission_rate DECIMAL(5,2),
    spa_commission_rate DECIMAL(5,2),
    other_commission_rate DECIMAL(5,2),

    -- Tiered Structure
    tier_structure JSONB, -- JSON array of tiers: [{"min": 0, "max": 10000, "rate": 10}, ...]

    -- Exclusions
    exclude_taxes BOOLEAN DEFAULT TRUE,
    exclude_fees BOOLEAN DEFAULT TRUE,
    exclude_deposits BOOLEAN DEFAULT FALSE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_travel_agent_commissions_tenant ON travel_agent_commissions(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_property ON travel_agent_commissions(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_company ON travel_agent_commissions(company_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_reservation ON travel_agent_commissions(reservation_id);
CREATE INDEX idx_travel_agent_commissions_status ON travel_agent_commissions(payment_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_dates ON travel_agent_commissions(period_start_date, period_end_date);
CREATE INDEX idx_travel_agent_commissions_payment_date ON travel_agent_commissions(payment_date) WHERE payment_status = 'paid';
CREATE INDEX idx_travel_agent_commissions_approval ON travel_agent_commissions(requires_approval) WHERE payment_status = 'pending';
CREATE INDEX idx_travel_agent_commissions_statement ON travel_agent_commissions(statement_number) WHERE included_in_statement = TRUE;

CREATE INDEX idx_commission_statements_company ON commission_statements(company_id);
CREATE INDEX idx_commission_statements_dates ON commission_statements(period_start_date, period_end_date);
CREATE INDEX idx_commission_statements_status ON commission_statements(payment_status);
CREATE INDEX idx_commission_statements_number ON commission_statements(statement_number);

CREATE INDEX idx_commission_rules_tenant ON commission_rules(tenant_id) WHERE is_active = TRUE;
CREATE INDEX idx_commission_rules_company ON commission_rules(company_id) WHERE is_active = TRUE;
CREATE INDEX idx_commission_rules_dates ON commission_rules(effective_from, effective_to) WHERE is_active = TRUE;

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE travel_agent_commissions IS 'Tracks commission calculations and payments for travel agents and OTAs';
COMMENT ON TABLE commission_statements IS 'Periodic commission statements summarizing multiple bookings';
COMMENT ON TABLE commission_rules IS 'Configurable rules for calculating commissions based on various criteria';
COMMENT ON COLUMN travel_agent_commissions.commission_type IS 'Type of commission calculation: percentage, flat rate, tiered, etc.';
COMMENT ON COLUMN travel_agent_commissions.net_commission IS 'Final commission amount after all adjustments and deductions (computed)';
COMMENT ON COLUMN commission_rules.tier_structure IS 'JSON structure defining commission tiers for graduated/tiered commissions';
