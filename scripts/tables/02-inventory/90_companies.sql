-- =============================================
-- Companies Table
-- =============================================
-- Description: Manages corporate clients, travel agencies, and business partners
-- Dependencies: tenants
-- Category: Business Relations (B2B)
-- =============================================

CREATE TABLE IF NOT EXISTS companies (
    -- Primary Key
    company_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Company Information
    company_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    company_code VARCHAR(50) UNIQUE,
    company_type VARCHAR(50) NOT NULL CHECK (company_type IN (
        'corporate',           -- Corporate client
        'travel_agency',       -- Travel agency/TMC
        'wholesaler',          -- Tour operator/wholesaler
        'ota',                 -- Online travel agency
        'event_planner',       -- Event management company
        'airline',             -- Airline crew/contracts
        'government',          -- Government entity
        'educational',         -- School/university
        'consortium',          -- Hotel consortium
        'partner'              -- General business partner
    )),

    -- Contact Details
    primary_contact_name VARCHAR(255),
    primary_contact_title VARCHAR(100),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_contact_phone VARCHAR(50),

    -- Address Information
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    -- Financial Terms
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    payment_terms INTEGER DEFAULT 30, -- Days (NET 30, NET 60, etc.)
    payment_terms_type VARCHAR(20) DEFAULT 'net_30' CHECK (payment_terms_type IN (
        'due_on_receipt',
        'net_15',
        'net_30',
        'net_45',
        'net_60',
        'net_90',
        'custom'
    )),
    credit_status VARCHAR(50) DEFAULT 'active' CHECK (credit_status IN (
        'pending',
        'active',
        'suspended',
        'blocked',
        'under_review',
        'expired',
        'revoked',
        'cancelled'
    )),

    -- Commission & Pricing
    commission_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage
    commission_type VARCHAR(50) CHECK (commission_type IN (
        'percentage',
        'flat_rate',
        'tiered',
        'net_rate',
        'none'
    )),
    preferred_rate_code VARCHAR(50),
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,

    -- Tax & Legal
    tax_id VARCHAR(50),
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_exempt_certificate_number VARCHAR(100),
    tax_exempt_expiry_date DATE,

    -- Contract Information
    contract_number VARCHAR(100),
    contract_start_date DATE,
    contract_end_date DATE,
    contract_status VARCHAR(50) CHECK (contract_status IN (
        'draft',
        'pending_approval',
        'active',
        'expiring_soon',
        'expired',
        'terminated',
        'renewed'
    )),
    auto_renew BOOLEAN DEFAULT FALSE,

    -- Website & Marketing
    website_url VARCHAR(500),
    iata_number VARCHAR(50), -- For travel agencies
    arc_number VARCHAR(50),  -- Airlines Reporting Corporation
    clia_number VARCHAR(50), -- Cruise Lines International Association

    -- Business Metrics
    total_bookings INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    average_booking_value DECIMAL(10,2),
    last_booking_date DATE,
    customer_lifetime_value DECIMAL(12,2),

    -- Preferences
    preferred_communication_method VARCHAR(50) DEFAULT 'email' CHECK (preferred_communication_method IN (
        'email',
        'phone',
        'portal',
        'fax',
        'mail'
    )),
    reporting_frequency VARCHAR(50) CHECK (reporting_frequency IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'on_demand',
        'none'
    )),

    -- Notes & Additional Info
    notes TEXT,
    internal_notes TEXT,
    tags TEXT[], -- Array of tags for categorization

    -- Status & Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_vip BOOLEAN DEFAULT FALSE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    version BIGINT DEFAULT 0
);

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE companies IS 'Manages corporate clients, travel agencies, and business partners for B2B relationships';
COMMENT ON COLUMN companies.company_type IS 'Type of business relationship: corporate, travel_agency, wholesaler, etc.';
COMMENT ON COLUMN companies.credit_limit IS 'Maximum credit allowed for the company';
COMMENT ON COLUMN companies.payment_terms IS 'Number of days for payment (NET 30, NET 60, etc.)';
COMMENT ON COLUMN companies.commission_rate IS 'Commission percentage for travel agencies and partners';
COMMENT ON COLUMN companies.tax_exempt IS 'Whether the company is exempt from taxes';
COMMENT ON COLUMN companies.iata_number IS 'International Air Transport Association number for travel agencies';
