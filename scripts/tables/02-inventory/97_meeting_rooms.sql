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
    room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique function space identifier

-- Multi-tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Room Information
room_code VARCHAR(50) NOT NULL, -- Short code used in schedules
room_name VARCHAR(200) NOT NULL, -- Display name for clients
room_type VARCHAR(50) NOT NULL CHECK (
    room_type IN (
        'BALLROOM',
        'CONFERENCE',
        'BOARDROOM',
        'MEETING',
        'BANQUET',
        'EXHIBITION',
        'OUTDOOR',
        'THEATER',
        'CLASSROOM',
        'FLEXIBLE'
    )
),

-- Location
building VARCHAR(100),
floor INTEGER,
location_description VARCHAR(500),

-- Capacity
max_capacity INTEGER NOT NULL, -- Maximum occupancy across setups
theater_capacity INTEGER, -- Rows of chairs facing stage
classroom_capacity INTEGER, -- Tables with chairs facing front
banquet_capacity INTEGER, -- Round tables with 10 seats
reception_capacity INTEGER, -- Standing room
u_shape_capacity INTEGER, -- U-shaped table arrangement
hollow_square_capacity INTEGER, -- Hollow square setup
boardroom_capacity INTEGER, -- Conference table setup

-- Physical Dimensions
area_sqm DECIMAL(10, 2), -- Metric area
area_sqft DECIMAL(10, 2), -- Imperial area
length_meters DECIMAL(8, 2), -- Length in meters
width_meters DECIMAL(8, 2), -- Width in meters
height_meters DECIMAL(8, 2), -- Height in meters
ceiling_height_meters DECIMAL(8, 2), -- Ceiling height in meters
length_feet DECIMAL(8, 2), -- Length in feet
width_feet DECIMAL(8, 2), -- Width in feet
height_feet DECIMAL(8, 2), -- Height in feet
ceiling_height_feet DECIMAL(8, 2), -- Ceiling height in feet

-- Features & Amenities
has_natural_light BOOLEAN DEFAULT FALSE, -- Indicates if the room has natural light
has_windows BOOLEAN DEFAULT FALSE, -- Indicates if the room has windows
has_stage BOOLEAN DEFAULT FALSE, -- Indicates if the room has a stage
has_dance_floor BOOLEAN DEFAULT FALSE, -- Indicates if the room has a dance floor
has_audio_visual BOOLEAN DEFAULT FALSE, -- Indicates if the room has audio-visual equipment
has_projector BOOLEAN DEFAULT FALSE, -- Indicates if the room has a projector
has_screen BOOLEAN DEFAULT FALSE, -- Indicates if the room has a screen
has_microphones BOOLEAN DEFAULT FALSE, -- Indicates if the room has microphones
has_sound_system BOOLEAN DEFAULT FALSE, -- Indicates if the room has a sound system
has_wifi BOOLEAN DEFAULT TRUE, -- Indicates if the room has Wi-Fi
has_video_conferencing BOOLEAN DEFAULT FALSE, -- Indicates if the room has video conferencing capabilities
has_whiteboard BOOLEAN DEFAULT FALSE, -- Indicates if the room has a whiteboard
has_flipchart BOOLEAN DEFAULT FALSE, -- Indicates if the room has a flipchart
has_podium BOOLEAN DEFAULT FALSE, -- Indicates if the room has a podium
has_climate_control BOOLEAN DEFAULT TRUE, -- Indicates if the room has climate control
has_lighting_control BOOLEAN DEFAULT TRUE, -- Indicates if the room has lighting control
has_soundproofing BOOLEAN DEFAULT FALSE, -- Indicates if the room is soundproofed
has_stage_lighting BOOLEAN DEFAULT FALSE, -- Indicates if the room has stage lighting
has_acoustic_treatment BOOLEAN DEFAULT FALSE, -- Indicates if the room has acoustic treatment
has_video_wall BOOLEAN DEFAULT FALSE, -- Indicates if the room has a video wall
has_intercom_system BOOLEAN DEFAULT FALSE, -- Indicates if the room has an intercom system
has_hearing_assistance BOOLEAN DEFAULT FALSE, -- Indicates if the room has hearing assistance systems
has_signage BOOLEAN DEFAULT FALSE, -- Indicates if the room has digital signage
has_refreshment_station BOOLEAN DEFAULT FALSE, -- Indicates if the room has a refreshment station
has_coat_check BOOLEAN DEFAULT FALSE, -- Indicates if the room has a coat check area
has_restrooms BOOLEAN DEFAULT FALSE, -- Indicates if the room has nearby restrooms
has_kitchenette BOOLEAN DEFAULT FALSE, -- Indicates if the room has a kitchenette
has_bar_area BOOLEAN DEFAULT FALSE, -- Indicates if the room has a bar area
has_outdoor_access BOOLEAN DEFAULT FALSE, -- Indicates if the room has outdoor access
has_balcony BOOLEAN DEFAULT FALSE, -- Indicates if the room has a balcony
has_fireplace BOOLEAN DEFAULT FALSE, -- Indicates if the room has a fireplace
has_artwork BOOLEAN DEFAULT FALSE, -- Indicates if the room has artwork/decor
has_plants BOOLEAN DEFAULT FALSE, -- Indicates if the room has plants/greenery
has_acoustic_ceiling BOOLEAN DEFAULT FALSE, -- Indicates if the room has an acoustic ceiling
has_smart_controls BOOLEAN DEFAULT FALSE, -- Indicates if the room has smart controls (e.g., lighting, AV)
has_energy_efficient_lighting BOOLEAN DEFAULT FALSE, -- Indicates if the room has energy-efficient lighting
has_recycling_bins BOOLEAN DEFAULT FALSE, -- Indicates if the room has recycling bins
has_air_purification BOOLEAN DEFAULT FALSE, -- Indicates if the room has air purification systems
has_solar_panels BOOLEAN DEFAULT FALSE, -- Indicates if the room is powered by solar panels
has_green_certification BOOLEAN DEFAULT FALSE, -- Indicates if the room has green building certification
has_sound_masking BOOLEAN DEFAULT FALSE, -- Indicates if the room has sound masking systems
has_touchless_features BOOLEAN DEFAULT FALSE, -- Indicates if the room has touchless features (e.g., faucets, doors)

-- Access & Logistics
wheelchair_accessible BOOLEAN DEFAULT FALSE, -- ADA compliance
loading_dock_dimensions VARCHAR(100), -- Size of loading dock access
has_loading_dock BOOLEAN DEFAULT FALSE, -- Loading dock availability
has_separate_entrance BOOLEAN DEFAULT FALSE, -- Separate entrance for event staff
has_service_elevator BOOLEAN DEFAULT FALSE, -- Service elevator availability
parking_spaces INTEGER, -- Number of dedicated parking spaces
elevator_access BOOLEAN DEFAULT FALSE, -- Elevator access availability

-- Setup Information
default_setup VARCHAR(50), -- THEATER, CLASSROOM, BANQUET, etc.
setup_time_minutes INTEGER DEFAULT 60, -- Time required to set up the room
teardown_time_minutes INTEGER DEFAULT 60, -- Time required to tear down the room
turnover_time_minutes INTEGER DEFAULT 30, -- Time between events

-- Pricing
hourly_rate DECIMAL(10, 2), -- Standard hourly rental rate
half_day_rate DECIMAL(10, 2), -- Half-day bundle rate
full_day_rate DECIMAL(10, 2), -- Full-day bundle rate
minimum_rental_hours INTEGER DEFAULT 1, -- Minimum billable hours
overtime_rate_per_hour DECIMAL(10, 2), -- Overtime surcharge
currency_code CHAR(3) DEFAULT 'USD', -- Billing currency

-- Operating Information
operating_hours_start TIME, -- Daily opening time
operating_hours_end TIME, -- Daily closing time
available_days VARCHAR(20) [], -- ['monday', 'tuesday', ...]
blackout_dates DATE[], -- Dates not available

-- Status
room_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (
    room_status IN (
        'AVAILABLE',
        'OCCUPIED',
        'MAINTENANCE',
        'BLOCKED',
        'OUT_OF_ORDER'
    )
),
is_active BOOLEAN DEFAULT TRUE,

-- Equipment & Inventory
included_equipment JSONB DEFAULT '[]'::jsonb, -- Items included in base rate
available_equipment JSONB DEFAULT '[]'::jsonb, -- Additional rentable items
furniture_inventory JSONB DEFAULT '[]'::jsonb, -- Tables, chairs, etc.
av_inventory JSONB DEFAULT '[]'::jsonb, -- AV equipment inventory
decor_inventory JSONB DEFAULT '[]'::jsonb, -- Decor items inventory
lighting_inventory JSONB DEFAULT '[]'::jsonb, -- Lighting equipment inventory
staging_inventory JSONB DEFAULT '[]'::jsonb, -- Staging equipment inventory
catering_inventory JSONB DEFAULT '[]'::jsonb, -- Catering equipment inventory
signage_inventory JSONB DEFAULT '[]'::jsonb, -- Signage options inventory
tech_support_available BOOLEAN DEFAULT FALSE, -- On-site tech support availability
setup_staff_available BOOLEAN DEFAULT FALSE, -- Setup staff availability
cleaning_staff_available BOOLEAN DEFAULT FALSE, -- Cleaning staff availability
security_staff_available BOOLEAN DEFAULT FALSE, -- Security staff availability
parking_available BOOLEAN DEFAULT FALSE, -- Parking availability for events
storage_space_available BOOLEAN DEFAULT FALSE, -- Storage space availability for event materials
loading_dock_available BOOLEAN DEFAULT FALSE, -- Loading dock availability for deliveries
catering_kitchen_available BOOLEAN DEFAULT FALSE, -- Catering kitchen availability for food prep
av_control_room_available BOOLEAN DEFAULT FALSE, -- AV control room availability for tech management
breakout_rooms_available BOOLEAN DEFAULT FALSE, -- Availability of adjacent breakout rooms
outdoor_space_available BOOLEAN DEFAULT FALSE, -- Availability of adjacent outdoor spaces
wifi_bandwidth_mbps INTEGER, -- Available Wi-Fi bandwidth in Mbps
internet_connection_type VARCHAR(50), -- Type of internet connection (e.g., Fiber, DSL)
network_security_protocols JSONB DEFAULT '[]'::jsonb, -- Supported network security protocols
backup_power_available BOOLEAN DEFAULT FALSE, -- Backup power availability (e.g., generators)
hvac_system_type VARCHAR(100), -- Type of HVAC system
lighting_system_type VARCHAR(100), -- Type of lighting system
sound_system_type VARCHAR(100), -- Type of sound system

-- Layout & Floor Plan
floor_plan_url VARCHAR(500), -- URL to downloadable floor plan PDF/image
layout_diagrams JSONB, -- Multiple setup layout images
virtual_tour_url VARCHAR(500), -- URL to 3D virtual tour
seating_chart_url VARCHAR(500), -- URL to seating chart image
stage_dimensions VARCHAR(100), -- Stage size details
dance_floor_dimensions VARCHAR(100), -- Dance floor size details
ceiling_type VARCHAR(100), -- Type of ceiling (e.g., drop ceiling, vaulted)
wall_finish VARCHAR(100), -- Wall finish type (e.g., drywall, paneling)
flooring_type VARCHAR(100), -- Flooring type (e.g., carpet, hardwood)
window_treatments VARCHAR(100), -- Type of window treatments (e.g., curtains, blinds)
acoustic_features VARCHAR(200), -- Acoustic treatment details

-- Photos & Marketing
primary_photo_url VARCHAR(500), -- Main photo URL
photo_gallery JSONB, -- Array of photo URLs
marketing_description TEXT, -- Marketing description for brochures/websites
amenities_description TEXT, -- Description of amenities offered
unique_selling_points TEXT, -- Key features that differentiate the space

-- Restrictions & Policies
noise_restrictions BOOLEAN DEFAULT FALSE, -- Noise level limitations
alcohol_allowed BOOLEAN DEFAULT TRUE, -- Alcohol consumption policy
smoking_allowed BOOLEAN DEFAULT FALSE, -- Smoking policy
food_restrictions TEXT, -- Food and beverage restrictions
decoration_policy TEXT, -- Decoration guidelines
cancellation_policy TEXT, -- Cancellation terms

-- Catering Information
catering_required BOOLEAN DEFAULT FALSE, -- Is catering mandatory for bookings
in_house_catering_available BOOLEAN DEFAULT FALSE, -- In-house catering option
external_catering_allowed BOOLEAN DEFAULT FALSE, -- External catering permitted
kitchen_access BOOLEAN DEFAULT FALSE, -- Access to kitchen facilities
bar_service_available BOOLEAN DEFAULT FALSE, -- Availability of bar service
dietary_options JSONB DEFAULT '[]'::jsonb, -- Supported dietary options
catering_menu_url VARCHAR(500), -- URL to catering menu
preferred_caterers JSONB DEFAULT '[]'::jsonb, -- List of preferred caterers
beverage_packages JSONB DEFAULT '[]'::jsonb, -- Available beverage packages
catering_pricing_details TEXT, -- Catering pricing information
max_catering_capacity INTEGER, -- Maximum number of guests for catered events
catering_setup_time_minutes INTEGER DEFAULT 60, -- Time required for catering setup
catering_teardown_time_minutes INTEGER DEFAULT 60, -- Time required for catering teardown
catering_contact_info JSONB, -- Contact details for catering inquiries

-- Technical Specifications
power_outlets INTEGER, -- Number of power outlets
network_ports INTEGER, -- Number of network ports
lighting_zones INTEGER, -- Number of controllable lighting zones
voltage VARCHAR(20), -- Electrical voltage details
amp_capacity INTEGER, -- Amperage capacity
av_integration_details TEXT, -- AV system integration information
tech_requirements TEXT, -- Special technical requirements
rigging_points INTEGER, -- Number of rigging points available
ceiling_load_capacity_kg INTEGER, -- Ceiling load capacity in kilograms
ceiling_load_capacity_lbs INTEGER, -- Ceiling load capacity in pounds
stage_rigging_available BOOLEAN DEFAULT FALSE, -- Stage rigging availability
lighting_rigging_available BOOLEAN DEFAULT FALSE, -- Lighting rigging availability
sound_rigging_available BOOLEAN DEFAULT FALSE, -- Sound rigging availability
av_rigging_available BOOLEAN DEFAULT FALSE, -- AV rigging availability
special_effects_rigging_available BOOLEAN DEFAULT FALSE, -- Special effects rigging availability
rigging_contact_info JSONB, -- Contact details for rigging inquiries
irdb_compliance BOOLEAN DEFAULT FALSE, -- IRDB compliance status
tech_support_contact_info JSONB, -- Contact details for technical support
emergency_procedures TEXT, -- Emergency procedures and protocols
safety_certifications JSONB DEFAULT '[]'::jsonb, -- Safety certifications held
fire_safety_equipment JSONB DEFAULT '[]'::jsonb, -- Fire safety equipment available
security_features JSONB DEFAULT '[]'::jsonb, -- Security features in place
emergency_exits INTEGER, -- Number of emergency exits
emergency_exit_locations JSONB DEFAULT '[]'::jsonb, -- Locations of emergency exits
accessibility_features JSONB DEFAULT '[]'::jsonb, -- Accessibility features available

-- Booking Configuration
min_advance_booking_hours INTEGER DEFAULT 24, -- Minimum lead-time
max_advance_booking_days INTEGER DEFAULT 365, -- Maximum lead-time
requires_approval BOOLEAN DEFAULT FALSE, -- Needs manual approval flag
auto_confirm BOOLEAN DEFAULT FALSE, -- Automatically confirm bookings

-- Notes
internal_notes TEXT, -- Staff-only notes
guest_facing_notes TEXT, -- Notes shown to clients
setup_instructions TEXT, -- Specific setup instructions
teardown_instructions TEXT, -- Specific teardown instructions
special_requirements TEXT, -- Any special requirements or considerations
emergency_contact_info JSONB, -- Emergency contact details
vendor_access_instructions TEXT, -- Instructions for vendor access
cleaning_instructions TEXT, -- Cleaning guidelines and instructions
maintenance_instructions TEXT, -- Maintenance guidelines and instructions
inspection_schedule TEXT, -- Inspection frequency and schedule
inspection_notes TEXT, -- Notes from inspections
regulatory_compliance TEXT, -- Regulatory compliance information
insurance_requirements TEXT, -- Insurance requirements for bookings
booking_restrictions TEXT, -- Any restrictions on bookings
cancellation_fees TEXT, -- Details on cancellation fees
rescheduling_policy TEXT, -- Policy on rescheduling bookings
payment_terms TEXT, -- Payment terms and conditions

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Custom fields and additional attributes

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP, -- Last modification timestamp
created_by UUID, -- Creator identifier
updated_by UUID, -- Last modifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Deletion timestamp
deleted_by UUID, -- Deleter identifier

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Row version for concurrency

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
