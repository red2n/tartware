-- =====================================================
-- 05_group_booking_types.sql
-- Dynamic Group Booking Type Reference Data
--
-- Purpose: Replace hardcoded group_booking_type ENUM
--          with configurable lookup table
-- 
-- Industry Standard: OPERA Group Codes, Delphi/Amadeus
--                    Sales & Catering, HTNG Group Types
--
-- Date: 2026-02-05
-- =====================================================

\c tartware

\echo 'Creating group_booking_types table...'

CREATE TABLE IF NOT EXISTS group_booking_types (
    -- Primary Key
    type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Multi-tenancy (NULL tenant_id = system default)
    tenant_id UUID,  -- NULL for system defaults available to all
    property_id UUID, -- NULL for tenant-level types
    
    -- Group Type Identification
    code VARCHAR(30) NOT NULL,           -- e.g., "CONF", "WED", "CORP"
    name VARCHAR(100) NOT NULL,          -- e.g., "Conference"
    description TEXT,                    -- Detailed description
    
    -- Classification
    segment VARCHAR(30) NOT NULL DEFAULT 'GROUP'
        CHECK (segment IN (
            'CORPORATE',    -- Business meetings, conferences
            'ASSOCIATION',  -- Associations, conventions
            'SOCIAL',       -- Weddings, reunions
            'TRAVEL',       -- Tours, travel groups
            'SPORTS',       -- Teams, tournaments
            'EDUCATIONAL',  -- Schools, universities
            'GOVERNMENT',   -- Government, military
            'CREW',         -- Airline, ship crews
            'OTHER'
        )),
    
    -- Revenue Classification (USALI)
    revenue_category VARCHAR(30) DEFAULT 'ROOMS'
        CHECK (revenue_category IN (
            'ROOMS',        -- Primarily room revenue
            'CATERING',     -- Primarily F&B/banquet
            'MIXED',        -- Both rooms and catering
            'MEETING_ONLY'  -- Day use / meeting rooms only
        )),
    
    -- Group Behavior
    requires_contract BOOLEAN DEFAULT TRUE,
    requires_deposit BOOLEAN DEFAULT TRUE,
    requires_rooming_list BOOLEAN DEFAULT TRUE,
    requires_billing_instructions BOOLEAN DEFAULT FALSE,
    
    -- Cutoff & Policies
    default_cutoff_days INTEGER DEFAULT 14,      -- Days before arrival
    default_attrition_pct DECIMAL(5,2) DEFAULT 20.00, -- Allowed shrinkage
    default_deposit_pct DECIMAL(5,2) DEFAULT 10.00,   -- Initial deposit
    
    -- Meeting/Catering Flags
    has_meeting_space BOOLEAN DEFAULT FALSE,
    has_catering BOOLEAN DEFAULT FALSE,
    has_av_equipment BOOLEAN DEFAULT FALSE,
    has_exhibit_space BOOLEAN DEFAULT FALSE,
    
    -- Room Block Defaults
    min_rooms_pickup INTEGER DEFAULT 10,
    default_comp_ratio INTEGER DEFAULT 50,  -- 1 comp per X rooms
    
    -- Arrival/Departure Patterns
    typical_arrival_day VARCHAR(10),         -- MON, TUE, etc.
    typical_departure_day VARCHAR(10),
    typical_length_nights INTEGER,
    
    -- Rate & Pricing
    rate_negotiable BOOLEAN DEFAULT TRUE,
    allows_dynamic_pricing BOOLEAN DEFAULT FALSE,
    default_discount_pct DECIMAL(5,2),
    
    -- Sales Attribution
    requires_sales_manager BOOLEAN DEFAULT TRUE,
    commission_eligible BOOLEAN DEFAULT TRUE,
    default_commission_pct DECIMAL(5,2) DEFAULT 10.00,
    
    -- Mapping to Legacy Enum
    legacy_enum_value VARCHAR(50),
    
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
    CONSTRAINT uk_group_booking_types_tenant_code 
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, code),
    
    CONSTRAINT chk_group_type_code_format
        CHECK (code ~ '^[A-Z0-9_]{1,30}$'),
    
    CONSTRAINT chk_group_type_attrition
        CHECK (default_attrition_pct IS NULL OR 
               (default_attrition_pct >= 0 AND default_attrition_pct <= 100)),
    
    CONSTRAINT chk_group_type_deposit
        CHECK (default_deposit_pct IS NULL OR 
               (default_deposit_pct >= 0 AND default_deposit_pct <= 100))
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE group_booking_types IS 
'Configurable group booking types (CONFERENCE, WEDDING, TOUR, etc.) 
replacing hardcoded ENUM. Includes cutoff policies, attrition percentages, 
meeting/catering flags, and revenue classification.';

COMMENT ON COLUMN group_booking_types.segment IS 
'Market segment: CORPORATE, ASSOCIATION, SOCIAL, TRAVEL, SPORTS, EDUCATIONAL, GOVERNMENT, CREW';

COMMENT ON COLUMN group_booking_types.revenue_category IS 
'Primary revenue: ROOMS, CATERING, MIXED, MEETING_ONLY';

COMMENT ON COLUMN group_booking_types.default_attrition_pct IS 
'Allowed percentage of room block that can be released without penalty';

COMMENT ON COLUMN group_booking_types.default_comp_ratio IS 
'Number of paid rooms per complimentary room (e.g., 50 = 1 comp per 50 rooms)';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_group_booking_types_tenant 
    ON group_booking_types(tenant_id, property_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_group_booking_types_active 
    ON group_booking_types(tenant_id, is_active, display_order) 
    WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_group_booking_types_segment 
    ON group_booking_types(segment, revenue_category) 
    WHERE deleted_at IS NULL;

CREATE INDEX idx_group_booking_types_legacy 
    ON group_booking_types(legacy_enum_value) 
    WHERE legacy_enum_value IS NOT NULL;

-- =====================================================
-- SYSTEM DEFAULT DATA
-- =====================================================

INSERT INTO group_booking_types (
    tenant_id, code, name, description,
    segment, revenue_category,
    requires_contract, requires_deposit, requires_rooming_list,
    default_cutoff_days, default_attrition_pct, default_deposit_pct,
    has_meeting_space, has_catering, has_av_equipment, has_exhibit_space,
    min_rooms_pickup, default_comp_ratio,
    typical_arrival_day, typical_departure_day, typical_length_nights,
    rate_negotiable, default_discount_pct,
    requires_sales_manager, commission_eligible, default_commission_pct,
    legacy_enum_value, display_order, color_code, icon, is_system
) VALUES
-- CONFERENCE
(NULL, 'CONF', 'Conference', 'Business conferences and training sessions',
 'CORPORATE', 'MIXED',
 TRUE, TRUE, TRUE,
 21, 20.00, 15.00,
 TRUE, TRUE, TRUE, FALSE,
 20, 40,
 'SUN', 'THU', 4,
 TRUE, 15.00,
 TRUE, TRUE, 10.00,
 'CONFERENCE', 10, '#007bff', 'users', TRUE),

-- CONVENTION
(NULL, 'CONV', 'Convention', 'Large-scale conventions with exhibits',
 'ASSOCIATION', 'MIXED',
 TRUE, TRUE, TRUE,
 30, 15.00, 20.00,
 TRUE, TRUE, TRUE, TRUE,
 100, 50,
 'SAT', 'WED', 4,
 TRUE, 20.00,
 TRUE, TRUE, 10.00,
 'CONVENTION', 15, '#6f42c1', 'landmark', TRUE),

-- CORPORATE MEETING
(NULL, 'CORP', 'Corporate Meeting', 'Board meetings and executive retreats',
 'CORPORATE', 'MIXED',
 TRUE, TRUE, FALSE,
 14, 10.00, 25.00,
 TRUE, TRUE, TRUE, FALSE,
 10, 25,
 'MON', 'WED', 2,
 TRUE, 10.00,
 TRUE, FALSE, 0.00,
 'CORPORATE', 20, '#28a745', 'building', TRUE),

-- WEDDING
(NULL, 'WED', 'Wedding', 'Wedding receptions and ceremonies',
 'SOCIAL', 'CATERING',
 TRUE, TRUE, TRUE,
 45, 15.00, 30.00,
 TRUE, TRUE, FALSE, FALSE,
 15, 30,
 'FRI', 'SUN', 2,
 TRUE, 10.00,
 TRUE, TRUE, 0.00,
 'WEDDING', 25, '#e83e8c', 'heart', TRUE),

-- TOUR GROUP
(NULL, 'TOUR', 'Tour Group', 'Leisure tours and travel groups',
 'TRAVEL', 'ROOMS',
 TRUE, TRUE, TRUE,
 30, 25.00, 10.00,
 FALSE, TRUE, FALSE, FALSE,
 25, 40,
 NULL, NULL, 2,
 TRUE, 25.00,
 TRUE, TRUE, 15.00,
 'TOUR_GROUP', 30, '#17a2b8', 'bus', TRUE),

-- SPORTS TEAM
(NULL, 'SPORTS', 'Sports Team', 'Athletic teams and sporting events',
 'SPORTS', 'ROOMS',
 TRUE, TRUE, TRUE,
 14, 10.00, 20.00,
 FALSE, TRUE, FALSE, FALSE,
 20, 50,
 'THU', 'SUN', 3,
 TRUE, 20.00,
 TRUE, TRUE, 10.00,
 'SPORTS_TEAM', 35, '#fd7e14', 'football-ball', TRUE),

-- EDUCATIONAL
(NULL, 'EDU', 'Educational', 'School trips and university groups',
 'EDUCATIONAL', 'ROOMS',
 TRUE, TRUE, TRUE,
 21, 20.00, 15.00,
 TRUE, TRUE, FALSE, FALSE,
 30, 50,
 'SUN', 'FRI', 5,
 TRUE, 30.00,
 TRUE, FALSE, 0.00,
 'EDUCATIONAL', 40, '#20c997', 'graduation-cap', TRUE),

-- GOVERNMENT
(NULL, 'GOV', 'Government', 'Government meetings and training',
 'GOVERNMENT', 'MIXED',
 TRUE, FALSE, TRUE,
 14, 10.00, 0.00,
 TRUE, TRUE, TRUE, FALSE,
 15, 50,
 'MON', 'FRI', 4,
 FALSE, 0.00,
 TRUE, FALSE, 0.00,
 'GOVERNMENT', 45, '#6c757d', 'landmark', TRUE),

-- AIRLINE CREW
(NULL, 'CREW', 'Airline Crew', 'Airline crew accommodations',
 'CREW', 'ROOMS',
 TRUE, FALSE, FALSE,
 0, 0.00, 0.00,
 FALSE, FALSE, FALSE, FALSE,
 0, 0,
 NULL, NULL, 1,
 FALSE, 40.00,
 TRUE, FALSE, 0.00,
 'AIRLINE_CREW', 50, '#343a40', 'plane', TRUE),

-- SOCIAL EVENT
(NULL, 'SOCIAL', 'Social Event', 'Reunions, anniversaries, celebrations',
 'SOCIAL', 'MIXED',
 TRUE, TRUE, TRUE,
 30, 20.00, 20.00,
 TRUE, TRUE, FALSE, FALSE,
 15, 40,
 'FRI', 'SUN', 2,
 TRUE, 15.00,
 TRUE, FALSE, 0.00,
 'SOCIAL', 55, '#ffc107', 'glass-cheers', TRUE),

-- SPECIAL EVENT
(NULL, 'EVENT', 'Special Event', 'Galas, fundraisers, product launches',
 'OTHER', 'CATERING',
 TRUE, TRUE, FALSE,
 30, 10.00, 25.00,
 TRUE, TRUE, TRUE, TRUE,
 5, 50,
 NULL, NULL, 1,
 TRUE, 10.00,
 TRUE, TRUE, 5.00,
 'SPECIAL_EVENT', 60, '#dc3545', 'star', TRUE),

-- INCENTIVE
(NULL, 'INCEN', 'Incentive', 'Corporate incentive and reward trips',
 'CORPORATE', 'MIXED',
 TRUE, TRUE, TRUE,
 45, 15.00, 25.00,
 TRUE, TRUE, TRUE, FALSE,
 30, 30,
 'THU', 'SUN', 3,
 TRUE, 15.00,
 TRUE, TRUE, 10.00,
 NULL, 65, '#28a745', 'award', TRUE),

-- SMERF (SOCIAL, MILITARY, EDUCATIONAL, RELIGIOUS, FRATERNAL)
(NULL, 'SMERF', 'SMERF', 'Social/Military/Educational/Religious/Fraternal',
 'ASSOCIATION', 'ROOMS',
 TRUE, TRUE, TRUE,
 30, 25.00, 15.00,
 TRUE, TRUE, FALSE, FALSE,
 25, 50,
 'THU', 'SUN', 3,
 TRUE, 25.00,
 TRUE, FALSE, 0.00,
 NULL, 70, '#6f42c1', 'users', TRUE),

-- RELIGIOUS
(NULL, 'RELIG', 'Religious', 'Church groups and religious retreats',
 'ASSOCIATION', 'ROOMS',
 TRUE, TRUE, TRUE,
 30, 20.00, 15.00,
 TRUE, TRUE, FALSE, FALSE,
 25, 50,
 'THU', 'SUN', 3,
 TRUE, 20.00,
 TRUE, FALSE, 0.00,
 NULL, 75, '#17a2b8', 'church', TRUE),

-- MILITARY
(NULL, 'MIL', 'Military', 'Military groups and events',
 'GOVERNMENT', 'ROOMS',
 TRUE, FALSE, TRUE,
 14, 10.00, 0.00,
 FALSE, TRUE, FALSE, FALSE,
 20, 50,
 NULL, NULL, 3,
 FALSE, 0.00,
 TRUE, FALSE, 0.00,
 NULL, 80, '#343a40', 'shield-alt', TRUE);

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT ON group_booking_types TO tartware_app;
GRANT INSERT, UPDATE ON group_booking_types TO tartware_app;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

\echo '✓ Table created: group_booking_types'
\echo '  - 15 system default group types seeded'
\echo '  - 9 market segments'
\echo '  - 4 revenue categories (ROOMS, CATERING, MIXED, MEETING_ONLY)'
\echo '  - Cutoff, attrition, and comp ratio defaults'
\echo ''
