-- =====================================================
-- 102_meeting_rooms.sql
-- Conference & Event Space Management
--
-- Purpose: Manage meeting rooms and event spaces
-- Industry Standard: OPERA (FUNCTION_SPACE), Protel (TAGUNGSRAUM),
--                    Delphi.fdc (Function Diary), EventPro
--
-- Use Cases:
-- - Corporate meetings and conferences
-- - Wedding receptions and banquets
-- - Training sessions and workshops
-- - Social events and parties
-- - Trade shows and exhibitions
--
-- Integrates with event bookings and banquet orders
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS meeting_rooms CASCADE;

CREATE TABLE meeting_rooms (
    -- Primary Key
    room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Room Information
    room_code VARCHAR(50) NOT NULL,
    room_name VARCHAR(200) NOT NULL,
    room_type VARCHAR(50) NOT NULL
        CHECK (room_type IN ('BALLROOM', 'CONFERENCE', 'BOARDROOM', 'MEETING', 'BANQUET', 'EXHIBITION', 'OUTDOOR', 'THEATER', 'CLASSROOM', 'FLEXIBLE')),

    -- Location
    building VARCHAR(100),
    floor INTEGER,
    location_description VARCHAR(500),

    -- Capacity
    max_capacity INTEGER NOT NULL,
    theater_capacity INTEGER, -- Rows of chairs facing stage
    classroom_capacity INTEGER, -- Tables with chairs facing front
    banquet_capacity INTEGER, -- Round tables with 10 seats
    reception_capacity INTEGER, -- Standing room
    u_shape_capacity INTEGER, -- U-shaped table arrangement
    hollow_square_capacity INTEGER, -- Hollow square setup
    boardroom_capacity INTEGER, -- Conference table setup

    -- Physical Dimensions
    area_sqm DECIMAL(10, 2),
    area_sqft DECIMAL(10, 2),
    length_meters DECIMAL(8, 2),
    width_meters DECIMAL(8, 2),
    height_meters DECIMAL(8, 2),
    ceiling_height_meters DECIMAL(8, 2),

    -- Features & Amenities
    has_natural_light BOOLEAN DEFAULT FALSE,
    has_windows BOOLEAN DEFAULT FALSE,
    has_stage BOOLEAN DEFAULT FALSE,
    has_dance_floor BOOLEAN DEFAULT FALSE,
    has_audio_visual BOOLEAN DEFAULT FALSE,
    has_projector BOOLEAN DEFAULT FALSE,
    has_screen BOOLEAN DEFAULT FALSE,
    has_microphones BOOLEAN DEFAULT FALSE,
    has_sound_system BOOLEAN DEFAULT FALSE,
    has_wifi BOOLEAN DEFAULT TRUE,
    has_video_conferencing BOOLEAN DEFAULT FALSE,
    has_whiteboard BOOLEAN DEFAULT FALSE,
    has_flipchart BOOLEAN DEFAULT FALSE,
    has_podium BOOLEAN DEFAULT FALSE,
    has_climate_control BOOLEAN DEFAULT TRUE,

    -- Access & Logistics
    wheelchair_accessible BOOLEAN DEFAULT FALSE,
    has_loading_dock BOOLEAN DEFAULT FALSE,
    has_separate_entrance BOOLEAN DEFAULT FALSE,
    parking_spaces INTEGER,
    elevator_access BOOLEAN DEFAULT FALSE,

    -- Setup Information
    default_setup VARCHAR(50), -- THEATER, CLASSROOM, BANQUET, etc.
    setup_time_minutes INTEGER DEFAULT 60,
    teardown_time_minutes INTEGER DEFAULT 60,
    turnover_time_minutes INTEGER DEFAULT 30, -- Time between events

    -- Pricing
    hourly_rate DECIMAL(10, 2),
    half_day_rate DECIMAL(10, 2),
    full_day_rate DECIMAL(10, 2),
    minimum_rental_hours INTEGER DEFAULT 1,
    overtime_rate_per_hour DECIMAL(10, 2),
    currency_code CHAR(3) DEFAULT 'USD',

    -- Operating Information
    operating_hours_start TIME,
    operating_hours_end TIME,
    available_days VARCHAR(20)[], -- ['monday', 'tuesday', ...]
    blackout_dates DATE[], -- Dates not available

    -- Status
    room_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (room_status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER')),
    is_active BOOLEAN DEFAULT TRUE,

    -- Equipment & Inventory
    included_equipment JSONB DEFAULT '[]'::jsonb, -- Items included in base rate
    available_equipment JSONB DEFAULT '[]'::jsonb, -- Additional rentable items
    furniture_inventory JSONB DEFAULT '[]'::jsonb, -- Tables, chairs, etc.

    -- Layout & Floor Plan
    floor_plan_url VARCHAR(500),
    layout_diagrams JSONB, -- Multiple setup layout images
    virtual_tour_url VARCHAR(500),

    -- Photos & Marketing
    primary_photo_url VARCHAR(500),
    photo_gallery JSONB, -- Array of photo URLs
    marketing_description TEXT,
    amenities_description TEXT,

    -- Restrictions & Policies
    noise_restrictions BOOLEAN DEFAULT FALSE,
    alcohol_allowed BOOLEAN DEFAULT TRUE,
    smoking_allowed BOOLEAN DEFAULT FALSE,
    food_restrictions TEXT,
    decoration_policy TEXT,
    cancellation_policy TEXT,

    -- Catering Information
    catering_required BOOLEAN DEFAULT FALSE,
    external_catering_allowed BOOLEAN DEFAULT FALSE,
    kitchen_access BOOLEAN DEFAULT FALSE,
    bar_service_available BOOLEAN DEFAULT FALSE,

    -- Technical Specifications
    power_outlets INTEGER,
    network_ports INTEGER,
    lighting_zones INTEGER,
    voltage VARCHAR(20),
    amp_capacity INTEGER,

    -- Booking Configuration
    min_advance_booking_hours INTEGER DEFAULT 24,
    max_advance_booking_days INTEGER DEFAULT 365,
    requires_approval BOOLEAN DEFAULT FALSE,
    auto_confirm BOOLEAN DEFAULT FALSE,

    -- Notes
    internal_notes TEXT,
    guest_facing_notes TEXT,
    setup_instructions TEXT,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT meeting_rooms_code_unique UNIQUE (tenant_id, property_id, room_code),
    CONSTRAINT meeting_rooms_capacity_check CHECK (max_capacity > 0),
    CONSTRAINT meeting_rooms_dimensions_check CHECK (
        (area_sqm IS NULL OR area_sqm > 0) AND
        (area_sqft IS NULL OR area_sqft > 0)
    ),
    CONSTRAINT meeting_rooms_pricing_check CHECK (
        hourly_rate IS NULL OR hourly_rate >= 0
    ),
    CONSTRAINT meeting_rooms_setup_time_check CHECK (
        setup_time_minutes >= 0 AND
        teardown_time_minutes >= 0 AND
        turnover_time_minutes >= 0
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE meeting_rooms IS 'Conference rooms, ballrooms, and event spaces for meetings and functions';
COMMENT ON COLUMN meeting_rooms.room_id IS 'Unique meeting room identifier (UUID)';
COMMENT ON COLUMN meeting_rooms.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN meeting_rooms.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN meeting_rooms.room_code IS 'Unique code for the meeting room (e.g., "GRAND-BALLROOM")';
COMMENT ON COLUMN meeting_rooms.room_name IS 'Display name (e.g., "Grand Ballroom")';
COMMENT ON COLUMN meeting_rooms.room_type IS 'Type of space: BALLROOM, CONFERENCE, BOARDROOM, etc.';
COMMENT ON COLUMN meeting_rooms.max_capacity IS 'Maximum number of people (fire code limit)';
COMMENT ON COLUMN meeting_rooms.theater_capacity IS 'Capacity in theater-style seating';
COMMENT ON COLUMN meeting_rooms.classroom_capacity IS 'Capacity in classroom-style setup';
COMMENT ON COLUMN meeting_rooms.banquet_capacity IS 'Capacity with round banquet tables';
COMMENT ON COLUMN meeting_rooms.setup_time_minutes IS 'Time required to set up the room';
COMMENT ON COLUMN meeting_rooms.turnover_time_minutes IS 'Buffer time between consecutive events';
COMMENT ON COLUMN meeting_rooms.included_equipment IS 'Equipment included in base rental rate (JSONB array)';
COMMENT ON COLUMN meeting_rooms.floor_plan_url IS 'URL to downloadable floor plan PDF/image';
COMMENT ON COLUMN meeting_rooms.metadata IS 'Custom fields and additional attributes';

\echo 'Meeting rooms table created successfully!'
