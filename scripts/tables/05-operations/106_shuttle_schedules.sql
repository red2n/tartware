-- =====================================================
-- 109_shuttle_schedules.sql
-- Recurring Shuttle Route Schedules
--
-- Purpose: Define recurring shuttle routes and schedules
-- Industry Standard: OPERA (SHUTTLE_SCHEDULES), Protel (SHUTTLE_FAHRPLAN),
--                    RMS (SHUTTLE_ROUTES), StayNTouch (TRANSPORT_SCHEDULE)
--
-- Use Cases:
-- - Fixed-route shuttle schedules (e.g., airport shuttle every 2 hours)
-- - Local attraction shuttles
-- - Shopping center routes
-- - Business district shuttles
-- - Capacity management and seat reservations
-- - Multi-stop route planning
--
-- Note: This table defines recurring schedules, not individual trips
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS shuttle_schedules CASCADE;

CREATE TABLE shuttle_schedules (
    -- Primary Key
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Schedule Information
    schedule_name VARCHAR(200) NOT NULL, -- "Airport Shuttle Route", "Beach Shuttle"
    schedule_code VARCHAR(50) NOT NULL, -- "AS-01", "BCH-01"
    description TEXT,

    -- Route Type
    route_type VARCHAR(50) NOT NULL
        CHECK (route_type IN (
            'AIRPORT', 'LOCAL_ATTRACTION', 'SHOPPING', 'BUSINESS_DISTRICT',
            'BEACH', 'SKI_RESORT', 'THEME_PARK', 'TRAIN_STATION', 'OTHER'
        )),

    -- Route Details
    route_name VARCHAR(200) NOT NULL,
    is_roundtrip BOOLEAN DEFAULT TRUE,
    is_loop BOOLEAN DEFAULT FALSE, -- Returns to starting point

    -- Stops (ordered array of JSONB objects)
    -- [{stop_order, location_name, address, coordinates, duration_minutes}]
    route_stops JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_stops INTEGER NOT NULL DEFAULT 2,

    -- Departure Point
    departure_location VARCHAR(500) NOT NULL,
    departure_address TEXT,
    departure_coordinates JSONB, -- {latitude, longitude}

    -- Destination (if not roundtrip/loop)
    destination_location VARCHAR(500),
    destination_address TEXT,
    destination_coordinates JSONB,

    -- Timing
    estimated_duration_minutes INTEGER NOT NULL,
    estimated_distance_km DECIMAL(8, 2),
    buffer_time_minutes INTEGER DEFAULT 10, -- Extra time for delays

    -- Schedule Pattern
    schedule_type VARCHAR(50) NOT NULL
        CHECK (schedule_type IN ('FIXED_TIME', 'INTERVAL', 'ON_DEMAND')),

    -- Fixed-Time Schedule (if schedule_type = 'FIXED_TIME')
    departure_times TIME[], -- Array of departure times

    -- Interval Schedule (if schedule_type = 'INTERVAL')
    interval_minutes INTEGER,
    first_departure_time TIME,
    last_departure_time TIME,

    -- Operating Days
    operates_monday BOOLEAN DEFAULT TRUE,
    operates_tuesday BOOLEAN DEFAULT TRUE,
    operates_wednesday BOOLEAN DEFAULT TRUE,
    operates_thursday BOOLEAN DEFAULT TRUE,
    operates_friday BOOLEAN DEFAULT TRUE,
    operates_saturday BOOLEAN DEFAULT TRUE,
    operates_sunday BOOLEAN DEFAULT TRUE,

    -- Special Days
    operates_holidays BOOLEAN DEFAULT TRUE,
    operates_on_closure_days BOOLEAN DEFAULT FALSE,
    special_operating_dates DATE[], -- Specific dates where schedule differs
    excluded_dates DATE[], -- Dates when shuttle does NOT run

    -- Seasonal Operation
    seasonal BOOLEAN DEFAULT FALSE,
    season_start_date DATE,
    season_end_date DATE,
    season_name VARCHAR(100), -- "Summer Season", "Ski Season"

    -- Vehicle Assignment
    default_vehicle_id UUID, -- Default vehicle for this route
    alternate_vehicle_ids UUID[], -- Backup vehicles
    vehicle_type_required VARCHAR(50),
    min_vehicle_capacity INTEGER,

    -- Capacity Management
    max_passengers_per_trip INTEGER NOT NULL,
    wheelchair_spots_available INTEGER DEFAULT 0,
    standee_capacity INTEGER DEFAULT 0, -- Standing room
    reservation_required BOOLEAN DEFAULT FALSE,
    walk_on_allowed BOOLEAN DEFAULT TRUE,
    advance_booking_hours INTEGER DEFAULT 0,

    -- Pricing
    service_type VARCHAR(50) NOT NULL DEFAULT 'COMPLIMENTARY'
        CHECK (service_type IN ('COMPLIMENTARY', 'PAID', 'PACKAGE_INCLUDED')),
    price_per_person DECIMAL(10, 2),
    child_price DECIMAL(10, 2),
    roundtrip_price DECIMAL(10, 2),
    currency_code CHAR(3) DEFAULT 'USD',

    -- Guest Eligibility
    guest_only BOOLEAN DEFAULT TRUE, -- Only hotel guests
    public_access BOOLEAN DEFAULT FALSE, -- Open to public
    minimum_age INTEGER,
    requires_room_key BOOLEAN DEFAULT FALSE,

    -- Status
    schedule_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
        CHECK (schedule_status IN ('ACTIVE', 'SUSPENDED', 'SEASONAL_INACTIVE', 'RETIRED')),
    active_from_date DATE,
    active_to_date DATE,

    -- Driver Assignment
    default_driver_id UUID,
    requires_specific_license BOOLEAN DEFAULT FALSE,
    license_type_required VARCHAR(100),

    -- Real-Time Tracking
    real_time_tracking_enabled BOOLEAN DEFAULT FALSE,
    tracking_available_to_guests BOOLEAN DEFAULT FALSE,
    tracking_url_template VARCHAR(500),

    -- Communication
    automated_notifications BOOLEAN DEFAULT TRUE,
    sms_reminders BOOLEAN DEFAULT FALSE,
    email_confirmations BOOLEAN DEFAULT TRUE,
    notification_minutes_before INTEGER DEFAULT 30,

    -- Boarding Information
    boarding_location VARCHAR(500),
    boarding_instructions TEXT,
    check_in_required BOOLEAN DEFAULT FALSE,
    check_in_minutes_before INTEGER DEFAULT 10,

    -- Weather Policies
    cancelled_if_weather VARCHAR(100), -- "Heavy snow", "High winds"
    weather_alternative_transport TEXT,

    -- Utilization Metrics
    average_occupancy_percent DECIMAL(5, 2),
    total_trips_ytd INTEGER DEFAULT 0,
    total_passengers_ytd INTEGER DEFAULT 0,
    no_show_rate_percent DECIMAL(5, 2),

    -- Performance
    on_time_performance_percent DECIMAL(5, 2),
    average_delay_minutes DECIMAL(5, 2),
    guest_satisfaction_rating DECIMAL(3, 2), -- Average rating

    -- Integration
    displayed_on_website BOOLEAN DEFAULT TRUE,
    displayed_on_app BOOLEAN DEFAULT TRUE,
    available_for_booking BOOLEAN DEFAULT TRUE,
    booking_url VARCHAR(500),
    external_booking_system VARCHAR(100),

    -- Safety & Compliance
    safety_briefing_required BOOLEAN DEFAULT FALSE,
    safety_briefing_text TEXT,
    insurance_required BOOLEAN DEFAULT TRUE,
    max_continuous_operation_hours INTEGER, -- Driver break requirements

    -- Alerts
    capacity_alert_threshold INTEGER, -- Alert when this many seats booked
    maintenance_alert BOOLEAN DEFAULT FALSE,
    vehicle_unavailable_alert BOOLEAN DEFAULT FALSE,

    -- Route Optimization
    preferred_route_path JSONB, -- GPS waypoints for optimal route
    avoid_tolls BOOLEAN DEFAULT FALSE,
    avoid_highways BOOLEAN DEFAULT FALSE,
    traffic_aware_routing BOOLEAN DEFAULT TRUE,

    -- Amenities
    wifi_available BOOLEAN DEFAULT FALSE,
    air_conditioning BOOLEAN DEFAULT TRUE,
    restroom_available BOOLEAN DEFAULT FALSE,
    refreshments_provided BOOLEAN DEFAULT FALSE,
    luggage_storage BOOLEAN DEFAULT TRUE,

    -- Notes
    internal_notes TEXT,
    driver_notes TEXT,
    guest_facing_description TEXT,
    terms_and_conditions TEXT,

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
    CONSTRAINT shuttle_schedule_code_unique UNIQUE (tenant_id, property_id, schedule_code),
    CONSTRAINT shuttle_capacity_check CHECK (max_passengers_per_trip > 0),
    CONSTRAINT shuttle_interval_check CHECK (
        schedule_type != 'INTERVAL' OR
        (interval_minutes IS NOT NULL AND first_departure_time IS NOT NULL AND last_departure_time IS NOT NULL)
    ),
    CONSTRAINT shuttle_operating_days_check CHECK (
        operates_monday OR operates_tuesday OR operates_wednesday OR
        operates_thursday OR operates_friday OR operates_saturday OR operates_sunday
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE shuttle_schedules IS 'Recurring shuttle route schedules for hotel transportation services';
COMMENT ON COLUMN shuttle_schedules.schedule_id IS 'Unique shuttle schedule identifier (UUID)';
COMMENT ON COLUMN shuttle_schedules.schedule_code IS 'Short code for the schedule (e.g., "AS-01" for Airport Shuttle 01)';
COMMENT ON COLUMN shuttle_schedules.route_stops IS 'Ordered array of stops with location, duration, and coordinates (JSONB)';
COMMENT ON COLUMN shuttle_schedules.schedule_type IS 'FIXED_TIME (specific times), INTERVAL (every N minutes), ON_DEMAND';
COMMENT ON COLUMN shuttle_schedules.departure_times IS 'Array of departure times if schedule_type=FIXED_TIME';
COMMENT ON COLUMN shuttle_schedules.interval_minutes IS 'Departure frequency if schedule_type=INTERVAL';
COMMENT ON COLUMN shuttle_schedules.reservation_required IS 'TRUE if guests must reserve in advance';
COMMENT ON COLUMN shuttle_schedules.walk_on_allowed IS 'TRUE if guests can board without reservation (space permitting)';
COMMENT ON COLUMN shuttle_schedules.real_time_tracking_enabled IS 'TRUE to provide live vehicle location to guests';
COMMENT ON COLUMN shuttle_schedules.on_time_performance_percent IS 'Percentage of trips departing/arriving on schedule';
COMMENT ON COLUMN shuttle_schedules.preferred_route_path IS 'GPS waypoints for optimal route navigation (JSONB)';
COMMENT ON COLUMN shuttle_schedules.metadata IS 'Custom fields for property-specific shuttle information';

\echo 'Shuttle schedules table created successfully!'
