-- =============================================
-- Travel Agent Commissions Table
-- =============================================
-- Description: Track and manage travel agent commission calculations and payments
-- Dependencies: companies, reservations, payments
-- Category: Financial Management
-- =============================================

CREATE TABLE IF NOT EXISTS travel_agent_commissions (
    -- Primary Key
    commission_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY, -- Unique commission record

-- Multi-tenancy
tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE, -- Tenant ownership
property_id UUID REFERENCES properties (id) ON DELETE CASCADE, -- Optional property scope

-- Agent & Reservation
company_id UUID NOT NULL REFERENCES companies (company_id) ON DELETE RESTRICT, -- Agency/company earning commission
reservation_id UUID NOT NULL, -- FK to reservations(id) ON DELETE RESTRICT - constraint added in constraints phase

-- Commission Period
commission_period VARCHAR(50) CHECK (
    commission_period IN (
        'monthly',
        'quarterly',
        'semi_annual',
        'annual',
        'per_booking',
        'on_checkout'
    )
),
period_start_date DATE, -- Start of commission period
period_end_date DATE, -- End of commission period

-- Revenue Breakdown
room_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Eligible room revenue
food_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Eligible food revenue
beverage_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Eligible beverage revenue
spa_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Eligible spa revenue
other_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Other eligible revenue
total_revenue DECIMAL(12, 2) NOT NULL, -- Combined commissionable revenue

-- Commission Calculation
commission_type VARCHAR(50) NOT NULL CHECK (
    commission_type IN (
        'percentage',
        'flat_rate',
        'tiered',
        'graduated',
        'performance_based',
        'net_rate'
    )
), -- Type of commission calculation

-- Percentage-based
room_commission_rate DECIMAL(5, 2), -- Commission rate for room revenue
food_beverage_commission_rate DECIMAL(5, 2), -- Commission rate for food and beverage revenue
spa_commission_rate DECIMAL(5, 2), -- Commission rate for spa revenue
other_commission_rate DECIMAL(5, 2), -- Commission rate for other revenue
overall_commission_rate DECIMAL(5, 2), -- Overall commission rate for combined revenue
-- Flat rate
flat_commission_amount DECIMAL(10, 2), -- Fixed commission amount

-- Calculated Commission
room_commission DECIMAL(12, 2) DEFAULT 0.00, -- Calculated payout by category
food_beverage_commission DECIMAL(12, 2) DEFAULT 0.00, -- Calculated payout for food and beverage
spa_commission DECIMAL(12, 2) DEFAULT 0.00, -- Calculated payout for spa
other_commission DECIMAL(12, 2) DEFAULT 0.00, -- Calculated payout for other
gross_commission DECIMAL(12, 2) NOT NULL, -- Sum of component commissions

-- Adjustments & Deductions
adjustment_amount DECIMAL(12, 2) DEFAULT 0.00, -- Manual adjustments
adjustment_reason TEXT, -- Reason for adjustment
tax_deducted DECIMAL(12, 2) DEFAULT 0.00, -- Withholding or other taxes
withholding_tax_rate DECIMAL(5, 2), -- Applicable tax rate
cancellation_deduction DECIMAL(12, 2) DEFAULT 0.00, -- No-show/cancel penalties
chargeback_amount DECIMAL(12, 2) DEFAULT 0.00, -- Chargebacks reducing payout

-- Net Commission
net_commission DECIMAL(12, 2) GENERATED ALWAYS AS (
    gross_commission + adjustment_amount - tax_deducted - cancellation_deduction - chargeback_amount
) STORED, -- Final payout after adjustments

-- Payment Information
payment_status VARCHAR(50) DEFAULT 'pending' CHECK (
    payment_status IN (
        'pending',
        'approved',
        'processing',
        'paid',
        'on_hold',
        'disputed',
        'cancelled'
    )
), -- Current payment status
payment_method VARCHAR(50) CHECK (
    payment_method IN (
        'bank_transfer',
        'check',
        'ach',
        'wire',
        'credit_note',
        'offset'
    )
), -- Payment method used
payment_date DATE, -- Actual pay date
payment_reference VARCHAR(100), -- Remittance reference/cheque #
payment_id UUID, -- FK to payments(id) - constraint added in constraints phase

-- Invoice
invoice_number VARCHAR(50) UNIQUE, -- Unique invoice identifier
invoice_date DATE, -- Invoice issuance date
invoice_due_date DATE, -- Payment due date
invoice_url TEXT, -- Link to invoice document
is_invoice_sent BOOLEAN DEFAULT FALSE, -- Invoice sent status
invoice_sent_date DATE, -- Date invoice was sent
invoice_sent_by UUID REFERENCES users (id), -- User who sent the invoice

-- Currency
currency_code VARCHAR(3) DEFAULT 'USD', -- Payout currency
exchange_rate DECIMAL(10, 4) DEFAULT 1.0000, -- Applied FX rate

-- Performance Tiers (for tiered/graduated commission)
tier_level INTEGER, -- Current tier level achieved
tier_threshold DECIMAL(12, 2), -- Revenue threshold for tier
bonus_commission DECIMAL(12, 2) DEFAULT 0.00, -- Additional bonus commission
performance_metrics JSONB, -- JSON object storing performance data

-- Booking Details
booking_date DATE, -- Date of original booking
checkin_date DATE, -- Guest check-in date
checkout_date DATE, -- Guest check-out date
number_of_nights INTEGER, -- Length of stay
number_of_rooms INTEGER, -- Number of rooms booked
guest_name VARCHAR(255), -- Name of the guest
confirmation_number VARCHAR(50), -- Booking confirmation number
booking_channel VARCHAR(100), -- OTA/agent channel used
rate_code VARCHAR(50), -- Rate code applied
market_segment VARCHAR(100), -- Market segment classification
special_requests TEXT, -- Any special requests noted
booking_status VARCHAR(50) CHECK (
    booking_status IN (
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled',
        'no_show'
    )
), -- Current booking status

-- Agency Details (snapshot at time of commission)
agency_name VARCHAR(255), -- Snapshot of agency name at payout
agency_code VARCHAR(50), -- Agency code (IATA/ARC)
agent_name VARCHAR(255), -- Contact person at agency
agent_email VARCHAR(255), -- Contact email at agency
agent_phone VARCHAR(50), -- Contact phone at agency
agent_address TEXT, -- Contact address at agency

-- Tax Documentation
tax_id_number VARCHAR(50), -- Agency tax identifier
tax_form_type VARCHAR(50), -- '1099', 'W9', etc.
tax_form_submitted BOOLEAN DEFAULT FALSE, -- Tax form submission status
tax_form_submitted_date DATE, -- Date tax form was submitted
tax_withholding_exemption BOOLEAN DEFAULT FALSE, -- Exemption status

-- Documentation
commission_agreement_url TEXT, -- Link to commission agreement document
supporting_documents TEXT [], -- Array of URLs to supporting documents

-- Statement Information
statement_number VARCHAR(50), -- Associated commission statement number
statement_date DATE, -- Date of the commission statement
included_in_statement BOOLEAN DEFAULT FALSE, -- Flag if included in statement

-- Approval Workflow
requires_approval BOOLEAN DEFAULT TRUE, -- Flag for approval requirement
is_approved BOOLEAN DEFAULT FALSE, -- Approval status
approved_by UUID REFERENCES users (id), -- User who approved
approved_at TIMESTAMP WITHOUT TIME ZONE, -- Timestamp of approval
approval_notes TEXT, -- Notes related to approval

-- Reconciliation
reconciled BOOLEAN DEFAULT FALSE, -- Reconciliation status
reconciled_date DATE, -- Date of reconciliation
reconciled_by UUID REFERENCES users (id), -- User who performed reconciliation

-- Notes
notes TEXT, -- External notes
internal_notes TEXT, -- Internal audit notes

-- Audit Fields
created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
created_by UUID REFERENCES users (id), -- User who created
updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
updated_by UUID REFERENCES users (id), -- User who last updated
is_deleted BOOLEAN DEFAULT FALSE, -- Deletion flag
deleted_at TIMESTAMP WITHOUT TIME ZONE, -- Deletion timestamp
deleted_by UUID REFERENCES users (id), -- User who deleted
version BIGINT DEFAULT 0, -- Version for optimistic locking

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
tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE, -- Tenant ownership
property_id UUID REFERENCES properties (id) ON DELETE CASCADE, -- Property ownership

-- Agent
company_id UUID NOT NULL REFERENCES companies (company_id) ON DELETE RESTRICT, -- Company ownership

-- Statement Details
statement_number VARCHAR(50) UNIQUE NOT NULL, -- Unique statement identifier
statement_date DATE NOT NULL, -- Date of the commission statement
period_start_date DATE NOT NULL, -- Start date of the statement period
period_end_date DATE NOT NULL, -- End date of the statement period

-- Summary
total_bookings INTEGER DEFAULT 0, -- Total number of bookings
total_room_nights INTEGER DEFAULT 0, -- Total number of room nights
total_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Total revenue
total_gross_commission DECIMAL(12, 2) DEFAULT 0.00, -- Total gross commission
total_adjustments DECIMAL(12, 2) DEFAULT 0.00, -- Total adjustments
total_deductions DECIMAL(12, 2) DEFAULT 0.00, -- Total deductions
total_net_commission DECIMAL(12, 2) DEFAULT 0.00, -- Total net commission

-- Payment
payment_status VARCHAR(50) DEFAULT 'pending' CHECK (
    payment_status IN (
        'pending',
        'approved',
        'paid',
        'on_hold',
        'cancelled'
    )
), -- Current payment status
payment_method VARCHAR(50) CHECK (
    payment_method IN (
        'bank_transfer',
        'check',
        'ach',
        'wire',
        'credit_note',
        'offset'
    )
), -- Payment method used
payment_date DATE, -- Actual pay date
payment_reference VARCHAR(100), -- Remittance reference/cheque #
payment_id UUID, -- FK to payments(id) - constraint added in constraints phase

-- Documents
statement_url TEXT, -- Link to statement document
supporting_documents TEXT [], -- Array of URLs to supporting documents

-- Status
is_finalized BOOLEAN DEFAULT FALSE, -- Finalization status
finalized_at TIMESTAMP WITHOUT TIME ZONE, -- Timestamp of finalization
finalized_by UUID REFERENCES users (id), -- User who finalized

-- Notes
notes TEXT, -- External notes
internal_notes TEXT, -- Internal audit notes

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
tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE, -- Tenant ownership
property_id UUID REFERENCES properties (id) ON DELETE CASCADE, -- Property ownership

-- Agent/Company
company_id UUID REFERENCES companies (company_id) ON DELETE CASCADE, -- Company ownership
apply_to_all_agents BOOLEAN DEFAULT FALSE, -- Flag to apply rule to all agents

-- Rule Details
rule_name VARCHAR(255) NOT NULL, -- Name of the commission rule
rule_description TEXT, -- Description of the rule
rule_priority INTEGER DEFAULT 0, -- Priority for rule application order

-- Applicability
applicable_booking_channels TEXT [], -- Applicable booking channels
applicable_room_types UUID [], -- Applicable room types
applicable_rate_codes TEXT [], -- Applicable rate codes
applicable_market_segments TEXT [], -- Applicable market segments

-- Date Range
effective_from DATE NOT NULL,
effective_to DATE, -- Effective date range for the rule

-- Commission Rates
room_commission_rate DECIMAL(5, 2), -- Commission rate for room revenue
food_beverage_commission_rate DECIMAL(5, 2), -- Commission rate for food and beverage
spa_commission_rate DECIMAL(5, 2), -- Commission rate for spa services
other_commission_rate DECIMAL(5, 2), -- Commission rate for other services
overall_commission_rate DECIMAL(5, 2), -- Overall commission rate
flat_commission_amount DECIMAL(10, 2), -- Fixed commission amount

-- Tiered Structure
tier_structure JSONB, -- JSON array of tiers: [{"min": 0, "max": 10000, "rate": 10}, ...]

-- Exclusions
exclude_taxes BOOLEAN DEFAULT TRUE, -- Whether to exclude taxes from commission calculations
exclude_fees BOOLEAN DEFAULT TRUE, -- Whether to exclude fees from commission calculations
exclude_deposits BOOLEAN DEFAULT FALSE, -- Whether to exclude deposits from commission calculations

-- Status
is_active BOOLEAN DEFAULT TRUE, -- Active status of the rule
-- Notes
notes TEXT, -- External notes
internal_notes TEXT, -- Internal audit notes

-- Audit
created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

COMMENT ON TABLE travel_agent_commissions IS 'Tracks commission calculations and payments for travel agents and OTAs';

COMMENT ON TABLE commission_statements IS 'Periodic commission statements summarizing multiple bookings';

COMMENT ON TABLE commission_rules IS 'Configurable rules for calculating commissions based on various criteria';

COMMENT ON COLUMN travel_agent_commissions.commission_type IS 'Type of commission calculation: percentage, flat rate, tiered, etc.';

COMMENT ON COLUMN travel_agent_commissions.net_commission IS 'Final commission amount after all adjustments and deductions (computed)';

COMMENT ON COLUMN commission_rules.tier_structure IS 'JSON structure defining commission tiers for graduated/tiered commissions';
