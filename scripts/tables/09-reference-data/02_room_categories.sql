-- =====================================================
-- 02_room_categories.sql
-- Dynamic Room Category Reference Data
--
-- Purpose: Replace hardcoded room_category ENUM with
--          configurable lookup table
--
-- Industry Standard: OPERA (ROOM_CATEGORY), Cloudbeds,
--                    Protel (ZIMMERKATEGORIE), STR Chain Scales
--
-- Date: 2026-02-05
-- =====================================================

\c tartware

\echo 'Creating room_categories table...'

CREATE TABLE IF NOT EXISTS room_categories (
    -- Primary Key
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy (NULL tenant_id = system default)
    tenant_id UUID,  -- NULL for system defaults available to all
    property_id UUID, -- NULL for tenant-level categories

    -- Category Identification
    code VARCHAR(30) NOT NULL,           -- e.g., "STD", "DLX", "STE"
    name VARCHAR(100) NOT NULL,          -- e.g., "Standard", "Deluxe"
    description TEXT,                    -- Marketing description

    -- Hierarchy
    parent_category_id UUID,             -- For sub-categories
    category_level INTEGER DEFAULT 1,    -- Hierarchy depth

    -- Classification
    tier VARCHAR(20) DEFAULT 'STANDARD'
        CHECK (tier IN ('ECONOMY', 'STANDARD', 'SUPERIOR', 'DELUXE', 'PREMIUM', 'LUXURY')),
    star_rating DECIMAL(2,1),            -- 1.0 to 5.0 star equivalent

    -- Pricing Tier
    rate_tier INTEGER DEFAULT 1,         -- 1=lowest, 5=highest for rate ordering
    base_rate_multiplier DECIMAL(5,4) DEFAULT 1.0000, -- Multiplier vs standard

    -- Capacity
    default_occupancy INTEGER DEFAULT 2,  -- Standard guests
    max_occupancy INTEGER DEFAULT 4,      -- Maximum guests
    default_adults INTEGER DEFAULT 2,
    max_adults INTEGER DEFAULT 4,
    default_children INTEGER DEFAULT 0,
    max_children INTEGER DEFAULT 2,

    -- Physical Attributes (defaults for rooms in this category)
    typical_square_feet INTEGER,          -- Approximate room size
    typical_square_meters INTEGER,
    has_separate_living BOOLEAN DEFAULT FALSE,  -- Suite indicator
    bedroom_count INTEGER DEFAULT 1,
    bathroom_count INTEGER DEFAULT 1,

    -- Features (default amenities for category)
    default_amenities JSONB DEFAULT '[]'::jsonb,
    default_features JSONB DEFAULT '{}'::jsonb,

    -- Mapping to Legacy Enum
    legacy_enum_value VARCHAR(50),        -- Maps to room_category ENUM

    -- Display & UI
    display_order INTEGER DEFAULT 0,
    color_code VARCHAR(7),
    icon VARCHAR(50),
    image_url VARCHAR(500),               -- Category promotional image

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
    CONSTRAINT uk_room_categories_tenant_code
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, code),

    CONSTRAINT fk_room_categories_parent
        FOREIGN KEY (parent_category_id)
        REFERENCES room_categories(category_id),

    CONSTRAINT chk_room_category_code_format
        CHECK (code ~ '^[A-Z0-9_]{1,30}$'),

    CONSTRAINT chk_room_category_occupancy
        CHECK (default_occupancy <= max_occupancy),

    CONSTRAINT chk_room_category_star_rating
        CHECK (star_rating IS NULL OR (star_rating >= 1.0 AND star_rating <= 5.0))
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE room_categories IS
'Configurable room category codes (Standard, Deluxe, Suite, etc.)
replacing hardcoded ENUM. Allows tenant-specific categories
with pricing tiers, capacity defaults, and feature sets.';

COMMENT ON COLUMN room_categories.tier IS
'Quality tier: ECONOMY, STANDARD, SUPERIOR, DELUXE, PREMIUM, LUXURY';

COMMENT ON COLUMN room_categories.rate_tier IS
'Pricing tier 1-5 used for rate ordering and revenue management';

COMMENT ON COLUMN room_categories.base_rate_multiplier IS
'Rate multiplier vs standard. 1.5 = 50% premium over base rate';

COMMENT ON COLUMN room_categories.has_separate_living IS
'TRUE for suites with separate living area';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_room_categories_tenant
    ON room_categories(tenant_id, property_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_room_categories_active
    ON room_categories(tenant_id, is_active, display_order)
    WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_room_categories_tier
    ON room_categories(tier, rate_tier)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_room_categories_legacy
    ON room_categories(legacy_enum_value)
    WHERE legacy_enum_value IS NOT NULL;

-- =====================================================
-- SYSTEM DEFAULT DATA
-- =====================================================

INSERT INTO room_categories (
    tenant_id, code, name, description,
    tier, star_rating, rate_tier, base_rate_multiplier,
    default_occupancy, max_occupancy, typical_square_feet,
    has_separate_living, bedroom_count,
    legacy_enum_value, display_order, color_code, icon, is_system
) VALUES
-- Standard
(NULL, 'STD', 'Standard', 'Comfortable accommodation with essential amenities',
 'STANDARD', 3.0, 1, 1.0000,
 2, 3, 250,
 FALSE, 1,
 'STANDARD', 10, '#6c757d', 'bed', TRUE),

-- Superior
(NULL, 'SUP', 'Superior', 'Enhanced room with additional space and amenities',
 'SUPERIOR', 3.5, 2, 1.2000,
 2, 3, 300,
 FALSE, 1,
 NULL, 20, '#17a2b8', 'bed', TRUE),

-- Deluxe
(NULL, 'DLX', 'Deluxe', 'Spacious room with premium furnishings and views',
 'DELUXE', 4.0, 3, 1.5000,
 2, 4, 400,
 FALSE, 1,
 'DELUXE', 30, '#007bff', 'star', TRUE),

-- Junior Suite
(NULL, 'JRS', 'Junior Suite', 'Open-plan suite with sitting area',
 'PREMIUM', 4.0, 4, 1.8000,
 2, 4, 500,
 FALSE, 1,
 NULL, 40, '#20c997', 'couch', TRUE),

-- Suite
(NULL, 'STE', 'Suite', 'Separate bedroom and living area',
 'PREMIUM', 4.5, 4, 2.0000,
 2, 4, 600,
 TRUE, 1,
 'SUITE', 50, '#28a745', 'door-open', TRUE),

-- Executive Suite
(NULL, 'EXE', 'Executive Suite', 'Luxury suite with work area and premium services',
 'LUXURY', 4.5, 5, 2.5000,
 2, 4, 800,
 TRUE, 1,
 'EXECUTIVE', 60, '#ffc107', 'briefcase', TRUE),

-- Presidential Suite
(NULL, 'PRS', 'Presidential Suite', 'Ultimate luxury with multiple rooms and exclusive amenities',
 'LUXURY', 5.0, 5, 4.0000,
 2, 6, 1500,
 TRUE, 2,
 'PRESIDENTIAL', 70, '#e83e8c', 'crown', TRUE),

-- Villa
(NULL, 'VLA', 'Villa', 'Standalone accommodation with private facilities',
 'LUXURY', 5.0, 5, 5.0000,
 4, 8, 2500,
 TRUE, 3,
 NULL, 80, '#6f42c1', 'home', TRUE),

-- Economy/Budget
(NULL, 'ECO', 'Economy', 'Budget-friendly basic accommodation',
 'ECONOMY', 2.5, 1, 0.8000,
 2, 2, 180,
 FALSE, 1,
 NULL, 5, '#adb5bd', 'bed', TRUE),

-- Accessible
(NULL, 'ADA', 'Accessible', 'ADA-compliant room with accessibility features',
 'STANDARD', 3.0, 1, 1.0000,
 2, 3, 300,
 FALSE, 1,
 NULL, 15, '#fd7e14', 'wheelchair', TRUE);

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT ON room_categories TO tartware_app;
GRANT INSERT, UPDATE ON room_categories TO tartware_app;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

\echo '✓ Table created: room_categories'
\echo '  - 10 system default categories seeded'
\echo '  - 6-tier classification (Economy to Luxury)'
\echo '  - Rate multipliers for pricing strategy'
\echo '  - Capacity and physical attribute defaults'
\echo ''
