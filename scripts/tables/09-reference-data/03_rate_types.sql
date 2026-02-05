-- =====================================================
-- 03_rate_types.sql
-- Dynamic Rate Type Reference Data
--
-- Purpose: Replace hardcoded rate_type ENUM with
--          configurable lookup table
-- 
-- Industry Standard: OPERA (RATE_CODE_TYPE), Cloudbeds,
--                    Protel (TARIFART), RMS Rate Categories
--
-- Date: 2026-02-05
-- =====================================================

\c tartware

\echo 'Creating rate_types table...'

CREATE TABLE IF NOT EXISTS rate_types (
    -- Primary Key
    type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Multi-tenancy (NULL tenant_id = system default)
    tenant_id UUID,  -- NULL for system defaults available to all
    property_id UUID, -- NULL for tenant-level types
    
    -- Rate Type Identification
    code VARCHAR(30) NOT NULL,           -- e.g., "RACK", "BAR", "CORP"
    name VARCHAR(100) NOT NULL,          -- e.g., "Best Available Rate"
    description TEXT,                    -- Detailed description
    
    -- Classification
    category VARCHAR(30) NOT NULL DEFAULT 'TRANSIENT'
        CHECK (category IN (
            'PUBLISHED',    -- Rack, public rates
            'TRANSIENT',    -- BAR, dynamic rates
            'NEGOTIATED',   -- Corporate, government
            'PROMOTIONAL',  -- Promos, coupons, flash sales
            'PACKAGE',      -- Bundled with inclusions
            'WHOLESALE',    -- Net rates for resellers
            'INTERNAL',     -- Comp, house use
            'RESTRICTION',  -- LOS, advance purchase
            'OTHER'
        )),
    
    -- Rate Behavior
    is_public BOOLEAN DEFAULT TRUE,       -- Visible to guests
    is_refundable BOOLEAN DEFAULT TRUE,   -- Cancellation allowed
    is_commissionable BOOLEAN DEFAULT TRUE, -- Pays agent commission
    is_discounted BOOLEAN DEFAULT FALSE,  -- Below rack rate
    is_yielded BOOLEAN DEFAULT TRUE,      -- Subject to revenue management
    is_derived BOOLEAN DEFAULT FALSE,     -- Calculated from parent rate
    
    -- Restrictions
    requires_deposit BOOLEAN DEFAULT FALSE,
    requires_prepayment BOOLEAN DEFAULT FALSE,
    requires_guarantee BOOLEAN DEFAULT TRUE,
    min_advance_days INTEGER DEFAULT 0,   -- Minimum booking lead time
    max_advance_days INTEGER,             -- Maximum booking window
    
    -- Commission & Distribution
    default_commission_pct DECIMAL(5,2),  -- Default agent commission
    ota_eligible BOOLEAN DEFAULT TRUE,    -- Distribute to OTAs
    gds_eligible BOOLEAN DEFAULT TRUE,    -- Distribute to GDS
    
    -- Priority (for rate selection)
    priority INTEGER DEFAULT 100,         -- Lower = higher priority
    rate_hierarchy_level INTEGER DEFAULT 1, -- 1=base, 2=derived, etc.
    
    -- Mapping to Legacy Enum
    legacy_enum_value VARCHAR(50),        -- Maps to rate_type ENUM
    
    -- Display & UI
    display_order INTEGER DEFAULT 0,
    color_code VARCHAR(7),
    icon VARCHAR(50),
    badge_text VARCHAR(20),               -- e.g., "SALE", "BEST VALUE"
    
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
    CONSTRAINT uk_rate_types_tenant_code 
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, code),
    
    CONSTRAINT chk_rate_type_code_format
        CHECK (code ~ '^[A-Z0-9_]{1,30}$'),
    
    CONSTRAINT chk_rate_type_commission
        CHECK (default_commission_pct IS NULL OR 
               (default_commission_pct >= 0 AND default_commission_pct <= 100))
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE rate_types IS 
'Configurable rate type codes (RACK, BAR, CORPORATE, etc.) 
replacing hardcoded ENUM. Allows tenant-specific rate types 
with behavioral flags for revenue management and distribution.';

COMMENT ON COLUMN rate_types.category IS 
'Classification: PUBLISHED, TRANSIENT, NEGOTIATED, PROMOTIONAL, PACKAGE, WHOLESALE, INTERNAL, RESTRICTION';

COMMENT ON COLUMN rate_types.is_yielded IS 
'TRUE if rate is subject to dynamic pricing/revenue management';

COMMENT ON COLUMN rate_types.is_derived IS 
'TRUE if rate is calculated from a parent rate (e.g., AAA = BAR - 10%)';

COMMENT ON COLUMN rate_types.priority IS 
'Rate selection priority. Lower value = selected first when multiple rates apply';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_rate_types_tenant 
    ON rate_types(tenant_id, property_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_rate_types_active 
    ON rate_types(tenant_id, is_active, display_order) 
    WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_rate_types_category 
    ON rate_types(category, is_public) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_rate_types_legacy 
    ON rate_types(legacy_enum_value) 
    WHERE legacy_enum_value IS NOT NULL;

-- =====================================================
-- SYSTEM DEFAULT DATA
-- =====================================================

INSERT INTO rate_types (
    tenant_id, code, name, description,
    category, is_public, is_refundable, is_commissionable, 
    is_discounted, is_yielded, is_derived,
    requires_prepayment, min_advance_days,
    priority, legacy_enum_value, display_order, color_code, icon, is_system
) VALUES
-- RACK - Published maximum rate
(NULL, 'RACK', 'Rack Rate', 'Published standard rate (highest price)',
 'PUBLISHED', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE,
 FALSE, 0,
 1000, 'RACK', 10, '#dc3545', 'tag', TRUE),

-- BAR - Best Available Rate
(NULL, 'BAR', 'Best Available Rate', 'Dynamic rate based on demand and availability',
 'TRANSIENT', TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
 FALSE, 0,
 100, 'BAR', 20, '#28a745', 'chart-line', TRUE),

-- CORPORATE - Negotiated corporate rate
(NULL, 'CORP', 'Corporate Rate', 'Negotiated rate for corporate accounts',
 'NEGOTIATED', FALSE, TRUE, TRUE, TRUE, FALSE, FALSE,
 FALSE, 0,
 200, 'CORPORATE', 30, '#007bff', 'building', TRUE),

-- GOVERNMENT - Government/military rate
(NULL, 'GOV', 'Government Rate', 'Rate for government and military personnel',
 'NEGOTIATED', TRUE, TRUE, FALSE, TRUE, FALSE, FALSE,
 FALSE, 0,
 200, 'GOVERNMENT', 35, '#17a2b8', 'landmark', TRUE),

-- TRAVEL_AGENT - Travel agent commissionable
(NULL, 'TA', 'Travel Agent Rate', 'Commissionable rate for travel agents',
 'NEGOTIATED', TRUE, TRUE, TRUE, TRUE, FALSE, FALSE,
 FALSE, 0,
 300, 'TRAVEL_AGENT', 40, '#6f42c1', 'plane', TRUE),

-- PROMO - Promotional rate
(NULL, 'PROMO', 'Promotional Rate', 'Limited-time promotional offer',
 'PROMOTIONAL', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE,
 FALSE, 0,
 150, 'PROMO', 50, '#ffc107', 'percent', TRUE),

-- COUPON - Discount code rate
(NULL, 'COUPON', 'Coupon Rate', 'Rate requiring valid discount code',
 'PROMOTIONAL', TRUE, TRUE, TRUE, TRUE, FALSE, FALSE,
 FALSE, 0,
 160, 'COUPON', 55, '#fd7e14', 'ticket-alt', TRUE),

-- EARLYBIRD - Advance purchase
(NULL, 'EARLY', 'Early Bird Rate', 'Discounted rate for advance booking',
 'RESTRICTION', TRUE, FALSE, TRUE, TRUE, TRUE, FALSE,
 TRUE, 14,
 120, 'EARLYBIRD', 60, '#20c997', 'clock', TRUE),

-- LASTMINUTE - Last minute deal
(NULL, 'LAST', 'Last Minute Rate', 'Discounted rate for bookings within 48 hours',
 'PROMOTIONAL', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE,
 FALSE, 0,
 130, 'LASTMINUTE', 65, '#e83e8c', 'bolt', TRUE),

-- NON_REFUNDABLE - Prepaid non-refundable
(NULL, 'NREF', 'Non-Refundable Rate', 'Lowest rate, no cancellation allowed',
 'RESTRICTION', TRUE, FALSE, TRUE, TRUE, TRUE, FALSE,
 TRUE, 0,
 110, 'NON_REFUNDABLE', 70, '#6c757d', 'lock', TRUE),

-- FLEXIBLE - Full flexibility
(NULL, 'FLEX', 'Flexible Rate', 'Higher rate with full cancellation flexibility',
 'TRANSIENT', TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
 FALSE, 0,
 105, 'FLEXIBLE', 75, '#28a745', 'undo', TRUE),

-- LOS - Length of stay
(NULL, 'LOS', 'Length of Stay Rate', 'Discount based on minimum stay requirement',
 'RESTRICTION', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE,
 FALSE, 0,
 140, 'LOS', 80, '#17a2b8', 'calendar-check', TRUE),

-- PACKAGE - Bundled rate
(NULL, 'PKG', 'Package Rate', 'Rate bundled with inclusions (breakfast, parking, etc.)',
 'PACKAGE', TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
 FALSE, 0,
 180, NULL, 85, '#007bff', 'box', TRUE),

-- WHOLESALE - Net rate
(NULL, 'NET', 'Wholesale/Net Rate', 'Net rate for wholesalers and bedbanks',
 'WHOLESALE', FALSE, TRUE, FALSE, TRUE, FALSE, FALSE,
 FALSE, 0,
 500, NULL, 90, '#adb5bd', 'warehouse', TRUE),

-- COMP - Complimentary
(NULL, 'COMP', 'Complimentary', 'Free room (VIP, service recovery, etc.)',
 'INTERNAL', FALSE, TRUE, FALSE, TRUE, FALSE, FALSE,
 FALSE, 0,
 900, 'COMP', 95, '#343a40', 'gift', TRUE),

-- HOUSE - House use
(NULL, 'HOUSE', 'House Use', 'Internal use (training, maintenance, staff)',
 'INTERNAL', FALSE, TRUE, FALSE, TRUE, FALSE, FALSE,
 FALSE, 0,
 910, 'HOUSE', 96, '#343a40', 'home', TRUE),

-- DERIVED - Derived rate (calculated)
(NULL, 'DRVD', 'Derived Rate', 'Rate derived from parent rate code',
 'OTHER', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
 FALSE, 0,
 50, 'DERIVED', 97, '#6c757d', 'sitemap', TRUE),

-- MANUAL - Manual override
(NULL, 'MANUAL', 'Manual Override', 'Manually set rate (overrides automation)',
 'OTHER', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE,
 FALSE, 0,
 999, 'MANUAL_OVERRIDE', 99, '#dc3545', 'edit', TRUE);

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT ON rate_types TO tartware_app;
GRANT INSERT, UPDATE ON rate_types TO tartware_app;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

\echo '✓ Table created: rate_types'
\echo '  - 18 system default rate types seeded'
\echo '  - 9 category classifications'
\echo '  - Behavioral flags for revenue management'
\echo '  - Distribution channel eligibility'
\echo ''
