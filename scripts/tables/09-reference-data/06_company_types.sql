-- =====================================================
-- 06_company_types.sql
-- Dynamic Company Type Reference Data
--
-- Purpose: Replace hardcoded company_type ENUM with
--          configurable lookup table
-- 
-- Industry Standard: OPERA Company Types, Sabre Profile
--                    Categories, HTNG Corporation Types
--
-- Date: 2026-02-05
-- =====================================================

\c tartware

\echo 'Creating company_types table...'

CREATE TABLE IF NOT EXISTS company_types (
    -- Primary Key
    type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Multi-tenancy (NULL tenant_id = system default)
    tenant_id UUID,  -- NULL for system defaults available to all
    property_id UUID, -- NULL for tenant-level types
    
    -- Company Type Identification
    code VARCHAR(30) NOT NULL,           -- e.g., "CORP", "OTA", "TA"
    name VARCHAR(100) NOT NULL,          -- e.g., "Online Travel Agency"
    description TEXT,                    -- Detailed description
    
    -- Classification
    category VARCHAR(30) NOT NULL DEFAULT 'CORPORATE'
        CHECK (category IN (
            'CORPORATE',      -- Direct corporate accounts
            'INTERMEDIARY',   -- Travel agents, wholesalers, OTAs
            'GOVERNMENT',     -- Government and military
            'ASSOCIATION',    -- Associations and non-profits
            'SUPPLIER',       -- Vendors and suppliers
            'PARTNER',        -- Strategic partners
            'INTERNAL',       -- Hotel management companies
            'OTHER'
        )),
    
    -- Relationship Type
    relationship_type VARCHAR(30) DEFAULT 'B2B'
        CHECK (relationship_type IN (
            'B2B',           -- Business customer
            'B2B2C',         -- Sells to consumers (OTA, TA)
            'B2G',           -- Government
            'VENDOR',        -- Supplier/vendor
            'AFFILIATE',     -- Affiliate partner
            'INTERNAL'       -- Same organization
        )),
    
    -- Billing & AR Settings
    has_ar_account BOOLEAN DEFAULT TRUE,  -- Can bill on credit
    requires_po BOOLEAN DEFAULT FALSE,    -- Requires purchase order
    default_payment_terms INTEGER DEFAULT 30, -- Days to pay
    default_credit_limit DECIMAL(15,2),
    
    -- Commission & Rates
    pays_commission BOOLEAN DEFAULT FALSE, -- Hotel pays them commission
    receives_commission BOOLEAN DEFAULT FALSE, -- They earn commission
    default_commission_pct DECIMAL(5,2),
    has_negotiated_rates BOOLEAN DEFAULT FALSE,
    rate_access_type VARCHAR(20) DEFAULT 'PUBLIC'
        CHECK (rate_access_type IN ('PUBLIC', 'NEGOTIATED', 'NET', 'CONFIDENTIAL')),
    
    -- Distribution Flags
    is_direct_sell BOOLEAN DEFAULT FALSE,  -- Sells directly to guests
    is_reseller BOOLEAN DEFAULT FALSE,     -- Resells inventory
    is_contracted BOOLEAN DEFAULT FALSE,   -- Has volume commitment
    is_preferred BOOLEAN DEFAULT FALSE,    -- Preferred partner status
    
    -- Tax & Compliance
    requires_w9 BOOLEAN DEFAULT FALSE,     -- US tax form
    requires_tax_exempt BOOLEAN DEFAULT FALSE,
    requires_insurance_cert BOOLEAN DEFAULT FALSE,
    
    -- Contact Requirements
    requires_travel_arranger BOOLEAN DEFAULT FALSE,
    requires_booker_list BOOLEAN DEFAULT FALSE,
    
    -- Volume & Performance
    tracks_production BOOLEAN DEFAULT TRUE,
    has_volume_commitment BOOLEAN DEFAULT FALSE,
    review_frequency VARCHAR(20) DEFAULT 'ANNUAL'
        CHECK (review_frequency IN ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'BIENNIAL', 'NONE')),
    
    -- Mapping to Legacy Enum
    legacy_enum_value VARCHAR(50),
    
    -- GDS/Distribution Codes
    iata_agency_type VARCHAR(10),          -- IATA agency classification
    arc_type VARCHAR(10),                  -- ARC (Airlines Reporting Corp)
    clia_type VARCHAR(10),                 -- CLIA (cruise lines)
    
    -- Display & UI
    display_order INTEGER DEFAULT 0,
    color_code VARCHAR(7),
    icon VARCHAR(50),
    
    -- System vs Custom
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- Constraints
    CONSTRAINT uk_company_types_tenant_code 
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, code),
    
    CONSTRAINT chk_company_type_code_format
        CHECK (code ~ '^[A-Z0-9_]{1,30}$'),
    
    CONSTRAINT chk_company_type_commission
        CHECK (default_commission_pct IS NULL OR 
               (default_commission_pct >= 0 AND default_commission_pct <= 100))
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE company_types IS 
'Configurable company/account types (CORPORATE, OTA, TRAVEL_AGENCY, etc.) 
replacing hardcoded ENUM. Includes billing terms, commission settings, 
and distribution channel classification.';

COMMENT ON COLUMN company_types.category IS 
'Classification: CORPORATE, INTERMEDIARY, GOVERNMENT, ASSOCIATION, SUPPLIER, PARTNER, INTERNAL';

COMMENT ON COLUMN company_types.rate_access_type IS 
'Rate visibility: PUBLIC (BAR), NEGOTIATED (corporate), NET (wholesale), CONFIDENTIAL';

COMMENT ON COLUMN company_types.is_reseller IS 
'TRUE if company resells hotel inventory (OTAs, wholesalers, bedbanks)';

COMMENT ON COLUMN company_types.iata_agency_type IS 
'IATA agency classification code for travel agencies';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_company_types_tenant 
    ON company_types(tenant_id, property_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_company_types_active 
    ON company_types(tenant_id, is_active, display_order) 
    WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_company_types_category 
    ON company_types(category, relationship_type) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_company_types_distrib 
    ON company_types(is_direct_sell, is_reseller) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_company_types_legacy 
    ON company_types(legacy_enum_value) 
    WHERE legacy_enum_value IS NOT NULL;

-- =====================================================
-- SYSTEM DEFAULT DATA
-- =====================================================

INSERT INTO company_types (
    tenant_id, code, name, description,
    category, relationship_type,
    has_ar_account, requires_po, default_payment_terms, default_credit_limit,
    pays_commission, receives_commission, default_commission_pct,
    has_negotiated_rates, rate_access_type,
    is_direct_sell, is_reseller, is_contracted, is_preferred,
    requires_w9, requires_tax_exempt,
    tracks_production, has_volume_commitment, review_frequency,
    legacy_enum_value, display_order, color_code, icon, is_system
) VALUES
-- CORPORATE - Direct corporate accounts
(NULL, 'CORP', 'Corporate Account', 'Direct corporate client with negotiated rates',
 'CORPORATE', 'B2B',
 TRUE, FALSE, 30, 50000.00,
 FALSE, FALSE, NULL,
 TRUE, 'NEGOTIATED',
 FALSE, FALSE, TRUE, FALSE,
 FALSE, FALSE,
 TRUE, TRUE, 'ANNUAL',
 'CORPORATE', 10, '#007bff', 'building', TRUE),

-- TRAVEL AGENCY - Traditional retail TA
(NULL, 'TA', 'Travel Agency', 'Traditional retail travel agency (IATA/ARC)',
 'INTERMEDIARY', 'B2B2C',
 TRUE, FALSE, 30, 25000.00,
 TRUE, TRUE, 10.00,
 TRUE, 'NEGOTIATED',
 TRUE, FALSE, FALSE, FALSE,
 TRUE, FALSE,
 TRUE, FALSE, 'ANNUAL',
 'TRAVEL_AGENCY', 20, '#6f42c1', 'plane-departure', TRUE),

-- ONLINE TRAVEL AGENCY
(NULL, 'OTA', 'Online Travel Agency', 'Online booking platform (Expedia, Booking.com)',
 'INTERMEDIARY', 'B2B2C',
 TRUE, FALSE, 30, 100000.00,
 TRUE, TRUE, 18.00,
 FALSE, 'PUBLIC',
 TRUE, TRUE, TRUE, FALSE,
 TRUE, FALSE,
 TRUE, TRUE, 'MONTHLY',
 'OTA', 25, '#e83e8c', 'globe', TRUE),

-- WHOLESALER
(NULL, 'WHOLE', 'Wholesaler', 'Wholesale/bedbank (Hotelbeds, Tourico)',
 'INTERMEDIARY', 'B2B',
 TRUE, FALSE, 45, 200000.00,
 TRUE, FALSE, NULL,
 TRUE, 'NET',
 FALSE, TRUE, TRUE, FALSE,
 TRUE, FALSE,
 TRUE, TRUE, 'MONTHLY',
 'WHOLESALER', 30, '#fd7e14', 'warehouse', TRUE),

-- DMC - Destination Management Company
(NULL, 'DMC', 'Destination Management', 'Destination management company',
 'INTERMEDIARY', 'B2B',
 TRUE, FALSE, 30, 50000.00,
 TRUE, TRUE, 10.00,
 TRUE, 'NEGOTIATED',
 FALSE, FALSE, TRUE, FALSE,
 TRUE, FALSE,
 TRUE, TRUE, 'ANNUAL',
 'DMC', 35, '#20c997', 'map-marked-alt', TRUE),

-- PCO - Professional Congress Organizer
(NULL, 'PCO', 'Congress Organizer', 'Professional congress/conference organizer',
 'INTERMEDIARY', 'B2B',
 TRUE, TRUE, 30, 75000.00,
 TRUE, TRUE, 10.00,
 TRUE, 'NEGOTIATED',
 FALSE, FALSE, TRUE, FALSE,
 FALSE, FALSE,
 TRUE, TRUE, 'ANNUAL',
 'PCO', 40, '#17a2b8', 'users-cog', TRUE),

-- GROUP OPERATOR
(NULL, 'GRP_OP', 'Group Operator', 'Tour and group operator',
 'INTERMEDIARY', 'B2B2C',
 TRUE, FALSE, 30, 50000.00,
 TRUE, TRUE, 12.00,
 TRUE, 'NEGOTIATED',
 TRUE, FALSE, TRUE, FALSE,
 TRUE, FALSE,
 TRUE, TRUE, 'ANNUAL',
 'GROUP_OPERATOR', 45, '#28a745', 'bus', TRUE),

-- AIRLINE
(NULL, 'AIRLINE', 'Airline', 'Airline crew and distressed passenger accounts',
 'CORPORATE', 'B2B',
 TRUE, TRUE, 30, 100000.00,
 FALSE, FALSE, NULL,
 TRUE, 'NEGOTIATED',
 FALSE, FALSE, TRUE, TRUE,
 FALSE, FALSE,
 TRUE, TRUE, 'ANNUAL',
 'AIRLINE', 50, '#343a40', 'plane', TRUE),

-- GOVERNMENT
(NULL, 'GOV', 'Government', 'Government agencies (per diem rates)',
 'GOVERNMENT', 'B2G',
 TRUE, TRUE, 30, 100000.00,
 FALSE, FALSE, NULL,
 TRUE, 'NEGOTIATED',
 FALSE, FALSE, TRUE, FALSE,
 FALSE, TRUE,
 TRUE, FALSE, 'ANNUAL',
 'GOVERNMENT', 55, '#6c757d', 'landmark', TRUE),

-- MILITARY
(NULL, 'MIL', 'Military', 'Military installations and personnel',
 'GOVERNMENT', 'B2G',
 TRUE, TRUE, 30, 50000.00,
 FALSE, FALSE, NULL,
 TRUE, 'NEGOTIATED',
 FALSE, FALSE, FALSE, FALSE,
 FALSE, TRUE,
 TRUE, FALSE, 'ANNUAL',
 NULL, 56, '#343a40', 'shield-alt', TRUE),

-- ASSOCIATION
(NULL, 'ASSOC', 'Association', 'Trade associations and non-profits',
 'ASSOCIATION', 'B2B',
 TRUE, FALSE, 30, 25000.00,
 FALSE, FALSE, NULL,
 TRUE, 'NEGOTIATED',
 FALSE, FALSE, FALSE, FALSE,
 FALSE, TRUE,
 TRUE, FALSE, 'ANNUAL',
 NULL, 60, '#ffc107', 'users', TRUE),

-- MANAGEMENT COMPANY
(NULL, 'MGMT', 'Management Company', 'Hotel management company',
 'INTERNAL', 'INTERNAL',
 FALSE, FALSE, 0, NULL,
 FALSE, FALSE, NULL,
 TRUE, 'CONFIDENTIAL',
 FALSE, FALSE, FALSE, FALSE,
 FALSE, FALSE,
 FALSE, FALSE, 'NONE',
 NULL, 70, '#adb5bd', 'hotel', TRUE),

-- GDS
(NULL, 'GDS', 'GDS', 'Global Distribution System (Amadeus, Sabre, Travelport)',
 'INTERMEDIARY', 'B2B',
 TRUE, FALSE, 30, 500000.00,
 TRUE, FALSE, NULL,
 FALSE, 'PUBLIC',
 FALSE, TRUE, TRUE, FALSE,
 TRUE, FALSE,
 TRUE, TRUE, 'MONTHLY',
 NULL, 75, '#dc3545', 'network-wired', TRUE),

-- METASEARCH
(NULL, 'META', 'Metasearch', 'Metasearch engine (Google, Trivago, Kayak)',
 'INTERMEDIARY', 'B2B2C',
 TRUE, FALSE, 30, 100000.00,
 TRUE, FALSE, NULL,
 FALSE, 'PUBLIC',
 FALSE, FALSE, FALSE, FALSE,
 TRUE, FALSE,
 TRUE, FALSE, 'MONTHLY',
 NULL, 76, '#4285f4', 'search', TRUE),

-- VENDOR
(NULL, 'VENDOR', 'Vendor/Supplier', 'Goods and services supplier',
 'SUPPLIER', 'VENDOR',
 FALSE, TRUE, 30, NULL,
 FALSE, FALSE, NULL,
 FALSE, 'PUBLIC',
 FALSE, FALSE, FALSE, FALSE,
 TRUE, FALSE,
 FALSE, FALSE, 'ANNUAL',
 NULL, 80, '#6c757d', 'truck', TRUE),

-- OTHER
(NULL, 'OTHER', 'Other', 'Other company type',
 'OTHER', 'B2B',
 TRUE, FALSE, 30, 10000.00,
 FALSE, FALSE, NULL,
 FALSE, 'PUBLIC',
 FALSE, FALSE, FALSE, FALSE,
 FALSE, FALSE,
 TRUE, FALSE, 'ANNUAL',
 'OTHER', 99, '#adb5bd', 'briefcase', TRUE);

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT ON company_types TO tartware_app;
GRANT INSERT, UPDATE ON company_types TO tartware_app;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

\echo '✓ Table created: company_types'
\echo '  - 16 system default company types seeded'
\echo '  - 8 category classifications'
\echo '  - 6 relationship types (B2B, B2B2C, B2G, etc.)'
\echo '  - Commission and rate access settings'
\echo '  - AR/billing configuration'
\echo ''
