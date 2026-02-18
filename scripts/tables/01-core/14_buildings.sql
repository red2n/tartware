-- =====================================================
-- 14_buildings.sql
-- Property Buildings & Wings
-- Industry Standard: OPERA Cloud (BUILDING), Protel (GEBAEUDE),
--                    Mews (SPACE_CATEGORY)
-- Pattern: Physical structure hierarchy within a property
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- BUILDINGS TABLE
-- Physical buildings, wings, or towers within a property
-- Used for room assignment, housekeeping routing, and
-- guest wayfinding
-- =====================================================

CREATE TABLE IF NOT EXISTS buildings (
    -- Primary Key
    building_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique building identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                 -- FK tenants.id
    property_id UUID NOT NULL,                               -- FK properties.id

    -- Building Identification
    building_code VARCHAR(50) NOT NULL,                      -- Short code (e.g., 'MAIN', 'TOWER-A', 'BEACH-WING')
    building_name VARCHAR(200) NOT NULL,                     -- Display name (e.g., 'Main Building')
    building_type VARCHAR(50) NOT NULL DEFAULT 'MAIN' CHECK (
        building_type IN (
            'MAIN',          -- Primary hotel building
            'WING',          -- Wing of the main building
            'TOWER',         -- Separate tower
            'ANNEX',         -- Annex building
            'VILLA',         -- Villa complex
            'COTTAGE',       -- Cottage cluster
            'BUNGALOW',      -- Bungalow area
            'CONFERENCE',    -- Conference center
            'SPA',           -- Spa building
            'RECREATION',    -- Recreation facility
            'OTHER'          -- Other structure
        )
    ),                                                       -- Building classification

    -- Location
    floor_count INTEGER,                                     -- Number of floors
    basement_floors INTEGER DEFAULT 0,                       -- Number of basement levels
    address_supplement VARCHAR(200),                          -- Additional address info (if separate from property)
    latitude DECIMAL(10, 7),                                 -- GPS latitude
    longitude DECIMAL(10, 7),                                -- GPS longitude
    distance_from_main_meters INTEGER,                       -- Distance from main building in meters

    -- Capacity
    total_rooms INTEGER DEFAULT 0,                           -- Room count in this building
    total_meeting_rooms INTEGER DEFAULT 0,                   -- Meeting room count
    total_outlets INTEGER DEFAULT 0,                         -- F&B outlet count

    -- Accessibility
    wheelchair_accessible BOOLEAN DEFAULT TRUE,              -- ADA/accessibility compliance
    elevator_count INTEGER DEFAULT 0,                        -- Number of elevators
    service_elevator_count INTEGER DEFAULT 0,                -- Service elevator count
    stairwell_count INTEGER DEFAULT 0,                       -- Number of stairwells

    -- Amenities
    has_lobby BOOLEAN DEFAULT FALSE,                         -- Building has its own lobby
    has_pool BOOLEAN DEFAULT FALSE,                          -- Swimming pool in/near building
    has_gym BOOLEAN DEFAULT FALSE,                           -- Fitness center
    has_spa BOOLEAN DEFAULT FALSE,                           -- Spa facilities
    has_restaurant BOOLEAN DEFAULT FALSE,                    -- On-site restaurant
    has_bar BOOLEAN DEFAULT FALSE,                           -- Bar/lounge
    has_parking BOOLEAN DEFAULT FALSE,                       -- Dedicated parking
    parking_spaces INTEGER DEFAULT 0,                        -- Number of parking spots
    has_loading_dock BOOLEAN DEFAULT FALSE,                  -- Loading dock for deliveries
    has_laundry BOOLEAN DEFAULT FALSE,                       -- Laundry facilities

    -- Operating Information
    year_built INTEGER,                                      -- Construction year
    last_renovation_year INTEGER,                            -- Last major renovation
    construction_type VARCHAR(100),                          -- Steel, concrete, wood, etc.

    -- Status
    is_active BOOLEAN DEFAULT TRUE,                          -- Active/inactive
    building_status VARCHAR(20) DEFAULT 'OPERATIONAL' CHECK (
        building_status IN ('OPERATIONAL', 'RENOVATION', 'CLOSED', 'SEASONAL')
    ),                                                       -- Operational status
    seasonal_open_date DATE,                                 -- If seasonal, opening date
    seasonal_close_date DATE,                                -- If seasonal, closing date

    -- Media
    photo_url VARCHAR(500),                                  -- Building photo
    floor_plan_url VARCHAR(500),                             -- Floor plan document

    -- Notes
    internal_notes TEXT,                                     -- Staff-only notes
    guest_description TEXT,                                  -- Guest-facing description

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                      -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP,                                    -- Last update timestamp
    created_by UUID,                                         -- Creator identifier
    updated_by UUID,                                         -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                        -- Soft delete flag
    deleted_at TIMESTAMP,                                    -- Deletion timestamp
    deleted_by UUID,                                         -- Deleter identifier

    -- Optimistic Locking
    version BIGINT DEFAULT 0,                                -- Row version for concurrency

    -- Constraints
    CONSTRAINT buildings_code_unique UNIQUE (tenant_id, property_id, building_code),
    CONSTRAINT buildings_floor_check CHECK (floor_count IS NULL OR floor_count > 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE buildings IS 'Physical buildings, wings, and towers within a property for room organization and guest wayfinding';
COMMENT ON COLUMN buildings.building_id IS 'Unique building identifier (UUID)';
COMMENT ON COLUMN buildings.building_code IS 'Short code for reports and integrations (e.g., MAIN, TOWER-A)';
COMMENT ON COLUMN buildings.building_name IS 'Display name shown to guests and staff';
COMMENT ON COLUMN buildings.building_type IS 'Classification: MAIN, WING, TOWER, ANNEX, VILLA, COTTAGE, etc.';
COMMENT ON COLUMN buildings.floor_count IS 'Total number of above-ground floors';
COMMENT ON COLUMN buildings.distance_from_main_meters IS 'Walking distance from main building in meters';
COMMENT ON COLUMN buildings.building_status IS 'Operational status: OPERATIONAL, RENOVATION, CLOSED, SEASONAL';

\echo 'buildings table created successfully!'
