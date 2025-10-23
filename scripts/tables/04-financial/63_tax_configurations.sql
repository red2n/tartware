-- =====================================================
-- Tax Configurations Table
-- =====================================================
-- Purpose: Manage tax rules, rates, and calculations
-- Key Features:
--   - Multi-jurisdiction tax support
--   - Date-based tax rate changes
--   - Tax exemption management
--   - Compliance tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS tax_configurations (
    -- Primary Key
    tax_config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Tax Identification
    tax_code VARCHAR(50) UNIQUE NOT NULL,
    tax_name VARCHAR(255) NOT NULL,
    tax_description TEXT,

    -- Tax Type
    tax_type VARCHAR(100) NOT NULL CHECK (tax_type IN (
        'sales_tax', 'vat', 'gst', 'occupancy_tax', 'tourism_tax',
        'city_tax', 'state_tax', 'federal_tax', 'resort_fee',
        'service_charge', 'excise_tax', 'customs_duty', 'other'
    )),
    tax_category VARCHAR(100),

    -- Jurisdiction
    country_code VARCHAR(3) NOT NULL,
    state_province VARCHAR(100),
    city VARCHAR(100),
    jurisdiction_name VARCHAR(255),
    jurisdiction_level VARCHAR(50) CHECK (jurisdiction_level IN ('federal', 'state', 'county', 'city', 'local', 'special')),

    -- Tax Authority
    tax_authority_name VARCHAR(255),
    tax_authority_id VARCHAR(100),
    tax_registration_number VARCHAR(100),
    tax_account_number VARCHAR(100),

    -- Tax Rate
    tax_rate DECIMAL(10,6) NOT NULL,
    is_percentage BOOLEAN DEFAULT TRUE,
    fixed_amount DECIMAL(10,2),

    -- Effective Dates
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Calculation Method
    calculation_method VARCHAR(100) CHECK (calculation_method IN (
        'inclusive', 'exclusive', 'compound', 'cascading',
        'additive', 'tiered', 'progressive', 'flat', 'custom'
    )),
    calculation_base VARCHAR(100) CHECK (calculation_base IN (
        'subtotal', 'total', 'room_only', 'services_only',
        'food_beverage_only', 'per_night', 'per_person', 'custom'
    )),

    -- Compounding Rules
    is_compound_tax BOOLEAN DEFAULT FALSE,
    compound_on_tax_codes VARCHAR(50)[],
    compound_order INTEGER,

    -- Rounding
    rounding_method VARCHAR(50) CHECK (rounding_method IN ('standard', 'up', 'down', 'nearest', 'none')),
    rounding_precision INTEGER DEFAULT 2,

    -- Applicability
    applies_to VARCHAR(100)[] DEFAULT ARRAY['rooms', 'services', 'food_beverage'], -- What items this tax applies to
    excluded_items VARCHAR(100)[],

    -- Rate Type
    rate_type VARCHAR(50) CHECK (rate_type IN ('standard', 'reduced', 'zero', 'exempt', 'reverse_charge')),

    -- Tiered Rates (for progressive tax)
    is_tiered BOOLEAN DEFAULT FALSE,
    tier_ranges JSONB, -- [{min_amount, max_amount, rate}, ...]

    -- Per Person/Night Calculations
    per_person_rate DECIMAL(10,2),
    per_night_rate DECIMAL(10,2),
    max_nights INTEGER,
    max_persons INTEGER,

    -- Minimum/Maximum
    minimum_taxable_amount DECIMAL(10,2),
    maximum_taxable_amount DECIMAL(10,2),
    minimum_tax_amount DECIMAL(10,2),
    maximum_tax_amount DECIMAL(10,2),

    -- Exemptions
    allows_exemptions BOOLEAN DEFAULT FALSE,
    exemption_types VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[], -- ['government', 'diplomatic', 'nonprofit', 'military']
    exemption_certificate_required BOOLEAN DEFAULT FALSE,

    -- Guest Type Applicability
    applies_to_guest_types VARCHAR(100)[] DEFAULT ARRAY['all'], -- ['transient', 'corporate', 'group', 'government', 'all']
    excluded_guest_types VARCHAR(100)[],

    -- Rate Code Applicability
    applies_to_rate_codes VARCHAR(100)[],
    excluded_rate_codes VARCHAR(100)[],

    -- Room Type Applicability
    applies_to_room_types UUID[],
    excluded_room_types UUID[],

    -- Seasonal Variations
    has_seasonal_rates BOOLEAN DEFAULT FALSE,
    seasonal_rates JSONB, -- [{start_date, end_date, rate, description}]

    -- Reporting
    tax_report_category VARCHAR(100),
    tax_gl_account VARCHAR(100),
    revenue_account VARCHAR(100),
    liability_account VARCHAR(100),

    -- Remittance
    remittance_frequency VARCHAR(50) CHECK (remittance_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'on_demand')),
    remittance_due_day INTEGER,
    last_remittance_date DATE,
    next_remittance_date DATE,

    -- Filing Requirements
    filing_required BOOLEAN DEFAULT FALSE,
    filing_frequency VARCHAR(50),
    filing_due_day INTEGER,
    last_filing_date DATE,
    next_filing_date DATE,

    -- Compliance
    requires_registration BOOLEAN DEFAULT FALSE,
    registration_date DATE,
    registration_expiry DATE,

    certificate_required BOOLEAN DEFAULT FALSE,
    certificate_number VARCHAR(100),
    certificate_expiry DATE,

    -- Display Settings
    display_on_invoice BOOLEAN DEFAULT TRUE,
    display_on_folio BOOLEAN DEFAULT TRUE,
    display_separately BOOLEAN DEFAULT TRUE,
    display_name VARCHAR(255),
    display_order INTEGER,

    -- Online Booking
    show_in_online_booking BOOLEAN DEFAULT TRUE,
    include_in_total_price BOOLEAN DEFAULT TRUE,

    -- Breakdown
    is_part_of_composite BOOLEAN DEFAULT FALSE,
    composite_tax_id UUID,

    -- Historical Tracking
    replaced_by_config_id UUID,
    replaces_config_id UUID,
    version INTEGER DEFAULT 1,

    -- Alerts
    alert_before_expiry_days INTEGER DEFAULT 30,
    expiry_alert_sent BOOLEAN DEFAULT FALSE,

    -- Validation Rules
    validation_rules JSONB, -- Custom validation rules
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Usage Statistics
    times_applied INTEGER DEFAULT 0,
    total_tax_collected DECIMAL(12,2) DEFAULT 0.00,
    last_applied_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,
    internal_notes TEXT,

    -- Regulatory References
    regulation_reference VARCHAR(255),
    regulation_url TEXT,

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

-- Indexes for tax_configurations

-- Composite Indexes for Common Queries

-- Comments
COMMENT ON TABLE tax_configurations IS 'Manages tax rules, rates, calculations, and compliance requirements';
COMMENT ON COLUMN tax_configurations.calculation_method IS 'How tax is calculated: inclusive, exclusive, compound, cascading, etc';
COMMENT ON COLUMN tax_configurations.is_compound_tax IS 'Whether this tax compounds on other taxes';
COMMENT ON COLUMN tax_configurations.tier_ranges IS 'JSON array for progressive/tiered tax rates: [{min_amount, max_amount, rate}]';
