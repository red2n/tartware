-- =====================================================
-- 108_transportation_requests.sql
-- Guest Transportation Requests
--
-- Purpose: Track guest requests for shuttle service, airport transfers, etc.
-- Industry Standard: OPERA (TRANSPORT_REQUESTS), Protel (TRANSFER_BUCHUNGEN),
--                    RMS (TRANSPORT_BOOKINGS), Mews (TRANSPORTATION)
--
-- Use Cases:
-- - Airport pickup/dropoff scheduling
-- - Shuttle service bookings
-- - Private car service requests
-- - Driver dispatch management
-- - Billing and revenue tracking
-- - Guest communication and notifications
--
-- Note: This table tracks individual transportation requests
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS transportation_requests CASCADE;

CREATE TABLE transportation_requests (
    -- Primary Key
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Request Information
    request_number VARCHAR(50) NOT NULL, -- Human-readable (e.g., "TRANS-2025-001")
    request_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_type VARCHAR(50) NOT NULL
        CHECK (request_type IN (
            'AIRPORT_ARRIVAL', 'AIRPORT_DEPARTURE', 'SHUTTLE', 'PRIVATE_TRANSFER',
            'LOCAL_TRANSPORT', 'TOUR', 'EMERGENCY', 'OTHER'
        )),

    -- Guest Information
    reservation_id UUID,
    guest_id UUID NOT NULL,
    guest_name VARCHAR(200) NOT NULL,
    guest_phone VARCHAR(50),
    guest_email VARCHAR(200),
    room_number VARCHAR(20),

    -- Passenger Details
    passenger_count INTEGER NOT NULL DEFAULT 1,
    child_count INTEGER DEFAULT 0,
    infant_count INTEGER DEFAULT 0,
    wheelchair_required BOOLEAN DEFAULT FALSE,
    child_seat_required BOOLEAN DEFAULT FALSE,
    special_needs TEXT,

    -- Luggage
    luggage_count INTEGER DEFAULT 0,
    oversized_luggage BOOLEAN DEFAULT FALSE,
    special_items TEXT, -- Golf clubs, skis, etc.

    -- Journey Details
    pickup_location VARCHAR(500) NOT NULL,
    pickup_location_type VARCHAR(50), -- HOTEL, AIRPORT, ADDRESS, LANDMARK
    pickup_address TEXT,
    pickup_coordinates JSONB, -- {latitude, longitude}

    dropoff_location VARCHAR(500) NOT NULL,
    dropoff_location_type VARCHAR(50),
    dropoff_address TEXT,
    dropoff_coordinates JSONB,

    -- Timing
    requested_pickup_datetime TIMESTAMP NOT NULL,
    requested_pickup_time TIME NOT NULL,
    actual_pickup_datetime TIMESTAMP,
    estimated_arrival_datetime TIMESTAMP,
    actual_arrival_datetime TIMESTAMP,

    -- Flight Details (if airport transfer)
    is_flight_related BOOLEAN DEFAULT FALSE,
    flight_number VARCHAR(50),
    airline VARCHAR(100),
    airline_code CHAR(3),
    terminal VARCHAR(50),
    arrival_departure VARCHAR(20), -- ARRIVAL, DEPARTURE
    flight_datetime TIMESTAMP,
    flight_tracking_enabled BOOLEAN DEFAULT FALSE,
    flight_status VARCHAR(50), -- ON_TIME, DELAYED, CANCELLED

    -- Vehicle Assignment
    vehicle_id UUID, -- Reference to vehicles table
    vehicle_number VARCHAR(50),
    vehicle_type VARCHAR(50),
    driver_id UUID,
    driver_name VARCHAR(200),
    driver_phone VARCHAR(50),

    -- Status
    request_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (request_status IN (
            'PENDING', 'CONFIRMED', 'ASSIGNED', 'DISPATCHED',
            'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED',
            'CANCELLED', 'NO_SHOW'
        )),
    confirmation_sent BOOLEAN DEFAULT FALSE,
    confirmation_sent_at TIMESTAMP,

    -- Dispatch
    dispatched BOOLEAN DEFAULT FALSE,
    dispatch_time TIMESTAMP,
    dispatched_by UUID,
    dispatch_notes TEXT,

    -- Completion
    completed_datetime TIMESTAMP,
    completed_by UUID,
    actual_distance_km DECIMAL(8, 2),
    actual_duration_minutes INTEGER,

    -- Guest Experience
    meet_and_greet BOOLEAN DEFAULT FALSE,
    signage_name VARCHAR(200), -- Name on pickup sign
    vip_service BOOLEAN DEFAULT FALSE,
    special_instructions TEXT,
    guest_preferences TEXT,

    -- Pricing
    service_type VARCHAR(50), -- COMPLIMENTARY, CHARGED, PACKAGE_INCLUDED
    base_rate DECIMAL(10, 2),
    per_km_rate DECIMAL(10, 2),
    per_hour_rate DECIMAL(10, 2),
    surcharge_amount DECIMAL(10, 2), -- Late night, holiday, etc.
    surcharge_reason VARCHAR(200),
    gratuity_amount DECIMAL(10, 2),
    total_charge DECIMAL(10, 2),
    currency_code CHAR(3) DEFAULT 'USD',

    -- Billing
    complimentary BOOLEAN DEFAULT FALSE,
    complimentary_reason TEXT,
    charge_to_room BOOLEAN DEFAULT TRUE,
    folio_id UUID,
    posted_to_folio BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50),

    -- Package/Promotion
    package_included BOOLEAN DEFAULT FALSE,
    package_id UUID,
    promotional_code VARCHAR(50),
    discount_percent DECIMAL(5, 2),
    discount_amount DECIMAL(10, 2),

    -- Third-Party Integration
    third_party_service BOOLEAN DEFAULT FALSE,
    third_party_provider VARCHAR(200), -- Uber, Lyft, local taxi
    third_party_booking_id VARCHAR(200),
    third_party_cost DECIMAL(10, 2),

    -- Communication
    sms_sent BOOLEAN DEFAULT FALSE,
    sms_sent_at TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP,
    guest_notified_arrival BOOLEAN DEFAULT FALSE,

    -- Tracking
    real_time_tracking_enabled BOOLEAN DEFAULT FALSE,
    tracking_url VARCHAR(500),
    current_location JSONB, -- Real-time vehicle location
    last_location_update TIMESTAMP,

    -- Rating & Feedback
    guest_rating INTEGER CHECK (guest_rating BETWEEN 1 AND 5),
    guest_feedback TEXT,
    feedback_date TIMESTAMP,
    driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
    service_quality_score INTEGER,

    -- Issues & Incidents
    issues_reported BOOLEAN DEFAULT FALSE,
    issue_description TEXT,
    incident_report_id UUID,
    compensation_provided BOOLEAN DEFAULT FALSE,
    compensation_amount DECIMAL(10, 2),

    -- Cancellation
    cancelled_by VARCHAR(50), -- GUEST, HOTEL, SYSTEM, WEATHER
    cancellation_datetime TIMESTAMP,
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(10, 2),
    cancellation_policy_applied VARCHAR(200),

    -- No-Show
    no_show_recorded BOOLEAN DEFAULT FALSE,
    no_show_fee DECIMAL(10, 2),
    no_show_follow_up TEXT,

    -- Weather & Conditions
    weather_conditions VARCHAR(100),
    traffic_conditions VARCHAR(100),
    route_notes TEXT,

    -- Environmental
    carbon_offset_offered BOOLEAN DEFAULT FALSE,
    carbon_offset_accepted BOOLEAN DEFAULT FALSE,
    carbon_offset_amount DECIMAL(8, 2), -- kg CO2

    -- Repeat/Recurring
    recurring BOOLEAN DEFAULT FALSE,
    recurring_schedule JSONB, -- For regular shuttle schedules
    parent_request_id UUID, -- Link to original request if recurring

    -- Integration
    pos_transaction_id VARCHAR(100),
    accounting_code VARCHAR(50),
    gl_account VARCHAR(50),
    external_system_id VARCHAR(100),

    -- Notes
    internal_notes TEXT,
    driver_notes TEXT,
    guest_visible_notes TEXT,

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
    CONSTRAINT transport_request_number_unique UNIQUE (tenant_id, property_id, request_number),
    CONSTRAINT transport_passenger_check CHECK (passenger_count > 0),
    CONSTRAINT transport_datetime_check CHECK (
        actual_pickup_datetime IS NULL OR
        actual_pickup_datetime >= requested_pickup_datetime - INTERVAL '2 hours'
    ),
    CONSTRAINT transport_rating_check CHECK (
        (guest_rating IS NULL OR guest_rating BETWEEN 1 AND 5) AND
        (driver_rating IS NULL OR driver_rating BETWEEN 1 AND 5)
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE transportation_requests IS 'Guest transportation requests including shuttles, airport transfers, and private car service';
COMMENT ON COLUMN transportation_requests.request_id IS 'Unique transportation request identifier (UUID)';
COMMENT ON COLUMN transportation_requests.request_number IS 'Human-readable request number (e.g., "TRANS-2025-001")';
COMMENT ON COLUMN transportation_requests.request_type IS 'Type: AIRPORT_ARRIVAL, AIRPORT_DEPARTURE, SHUTTLE, PRIVATE_TRANSFER, etc.';
COMMENT ON COLUMN transportation_requests.wheelchair_required IS 'TRUE if wheelchair-accessible vehicle is needed';
COMMENT ON COLUMN transportation_requests.flight_tracking_enabled IS 'TRUE to monitor flight status for automatic pickup adjustments';
COMMENT ON COLUMN transportation_requests.request_status IS 'Status: PENDING, CONFIRMED, ASSIGNED, DISPATCHED, EN_ROUTE, COMPLETED, etc.';
COMMENT ON COLUMN transportation_requests.meet_and_greet IS 'TRUE if driver should meet guest with signage';
COMMENT ON COLUMN transportation_requests.signage_name IS 'Name to display on pickup sign';
COMMENT ON COLUMN transportation_requests.real_time_tracking_enabled IS 'TRUE to provide guest with live vehicle tracking';
COMMENT ON COLUMN transportation_requests.tracking_url IS 'URL for guest to track vehicle in real-time';
COMMENT ON COLUMN transportation_requests.carbon_offset_offered IS 'TRUE if carbon offset option was presented to guest';
COMMENT ON COLUMN transportation_requests.metadata IS 'Custom fields for property-specific transportation data';

\echo 'Transportation requests table created successfully!'
