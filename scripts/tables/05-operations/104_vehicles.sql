-- =====================================================
-- 107_vehicles.sql
-- Transportation Fleet Management
--
-- Purpose: Master list of hotel-owned or contracted vehicles
-- Industry Standard: OPERA (TRANSPORT_VEHICLES), Protel (FAHRZEUGE),
--                    RMS (FLEET), StayNTouch (SHUTTLE_FLEET)
--
-- Use Cases:
-- - Hotel shuttle fleet management
-- - Airport transfer vehicles
-- - Luxury car service
-- - Rental car tracking
-- - Maintenance scheduling
-- - Driver assignment
--
-- Note: This table defines the available vehicle fleet
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS vehicles CASCADE;

CREATE TABLE vehicles (
    -- Primary Key
    vehicle_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Vehicle Identification
    vehicle_number VARCHAR(50) NOT NULL, -- Internal fleet number
    vehicle_name VARCHAR(200), -- "Airport Shuttle A", "Executive Sedan 1"
    license_plate VARCHAR(50) NOT NULL,
    vin VARCHAR(100), -- Vehicle Identification Number
    registration_number VARCHAR(100),

    -- Vehicle Type
    vehicle_type VARCHAR(50) NOT NULL
        CHECK (vehicle_type IN (
            'SHUTTLE_BUS', 'MINIBUS', 'VAN', 'SEDAN', 'SUV', 'LIMOUSINE',
            'LUXURY_CAR', 'ELECTRIC_VEHICLE', 'GOLF_CART', 'BICYCLE', 'OTHER'
        )),
    vehicle_category VARCHAR(50), -- ECONOMY, STANDARD, LUXURY, EXECUTIVE

    -- Capacity
    passenger_capacity INTEGER NOT NULL,
    wheelchair_accessible BOOLEAN DEFAULT FALSE,
    wheelchair_capacity INTEGER DEFAULT 0,
    luggage_capacity INTEGER,
    cargo_capacity_cubic_meters DECIMAL(6, 2),

    -- Make & Model
    manufacturer VARCHAR(100), -- Tesla, Mercedes-Benz, Ford
    model VARCHAR(100),
    model_year INTEGER,
    trim_level VARCHAR(100),
    color VARCHAR(50),
    color_code VARCHAR(20),

    -- Fuel & Power
    fuel_type VARCHAR(50)
        CHECK (fuel_type IN (
            'GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUG_IN_HYBRID', 'HYDROGEN', 'OTHER'
        )),
    fuel_tank_capacity_liters DECIMAL(6, 2),
    electric_range_km INTEGER,
    battery_capacity_kwh DECIMAL(6, 2),
    charging_time_minutes INTEGER,

    -- Status
    vehicle_status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (vehicle_status IN (
            'AVAILABLE', 'IN_USE', 'OUT_OF_SERVICE', 'MAINTENANCE', 'RETIRED', 'RESERVED'
        )),
    operational BOOLEAN DEFAULT TRUE,
    out_of_service_reason TEXT,
    out_of_service_since TIMESTAMP,

    -- Ownership
    ownership_type VARCHAR(50) NOT NULL
        CHECK (ownership_type IN ('OWNED', 'LEASED', 'CONTRACTED', 'RENTAL')),
    owner_name VARCHAR(200),
    lease_start_date DATE,
    lease_end_date DATE,
    lease_monthly_cost DECIMAL(10, 2),

    -- Insurance
    insurance_company VARCHAR(200),
    insurance_policy_number VARCHAR(100),
    insurance_expiration_date DATE,
    insurance_coverage_amount DECIMAL(12, 2),
    insurance_deductible DECIMAL(10, 2),

    -- Registration & Compliance
    registration_expiration_date DATE,
    inspection_due_date DATE,
    emissions_test_date DATE,
    safety_certification_date DATE,

    -- Mileage & Usage
    odometer_reading_km INTEGER DEFAULT 0,
    last_odometer_update TIMESTAMP,
    total_km_driven INTEGER DEFAULT 0,
    average_km_per_day DECIMAL(8, 2),

    -- Maintenance
    last_service_date DATE,
    last_service_km INTEGER,
    next_service_due_date DATE,
    next_service_due_km INTEGER,
    service_interval_km INTEGER DEFAULT 5000,
    service_interval_months INTEGER DEFAULT 6,
    maintenance_notes TEXT,

    -- Features & Amenities
    air_conditioning BOOLEAN DEFAULT TRUE,
    gps_navigation BOOLEAN DEFAULT FALSE,
    wifi_enabled BOOLEAN DEFAULT FALSE,
    bluetooth_audio BOOLEAN DEFAULT FALSE,
    usb_charging BOOLEAN DEFAULT FALSE,
    leather_seats BOOLEAN DEFAULT FALSE,
    sunroof BOOLEAN DEFAULT FALSE,
    entertainment_system BOOLEAN DEFAULT FALSE,
    child_seat_available BOOLEAN DEFAULT FALSE,
    pet_friendly BOOLEAN DEFAULT FALSE,

    -- Safety Features
    abs_brakes BOOLEAN DEFAULT TRUE,
    airbags_count INTEGER,
    backup_camera BOOLEAN DEFAULT FALSE,
    blind_spot_monitoring BOOLEAN DEFAULT FALSE,
    lane_departure_warning BOOLEAN DEFAULT FALSE,
    collision_avoidance BOOLEAN DEFAULT FALSE,
    emergency_kit BOOLEAN DEFAULT TRUE,
    fire_extinguisher BOOLEAN DEFAULT TRUE,

    -- Tracking & Telematics
    gps_tracker_installed BOOLEAN DEFAULT FALSE,
    tracker_serial_number VARCHAR(100),
    telematics_provider VARCHAR(100),
    real_time_tracking BOOLEAN DEFAULT FALSE,
    last_gps_location JSONB, -- {latitude, longitude, timestamp}

    -- Assignment
    default_driver_id UUID, -- Default assigned driver
    current_driver_id UUID, -- Currently driving
    home_location VARCHAR(200), -- Parking location
    parking_spot VARCHAR(50),

    -- Operational Schedule
    service_hours_start TIME,
    service_hours_end TIME,
    available_days VARCHAR(50), -- "Mon-Sun", "Weekdays Only"
    operates_24_7 BOOLEAN DEFAULT FALSE,

    -- Pricing (if charged to guests)
    base_rate_per_km DECIMAL(10, 2),
    base_rate_per_hour DECIMAL(10, 2),
    minimum_charge DECIMAL(10, 2),
    airport_transfer_flat_rate DECIMAL(10, 2),
    currency_code CHAR(3) DEFAULT 'USD',

    -- Costs (operational)
    purchase_price DECIMAL(12, 2),
    purchase_date DATE,
    current_value DECIMAL(12, 2),
    depreciation_per_year DECIMAL(10, 2),
    average_fuel_cost_per_km DECIMAL(6, 3),
    maintenance_cost_ytd DECIMAL(10, 2),
    total_operating_cost_ytd DECIMAL(10, 2),

    -- Incidents & Accidents
    accident_history_count INTEGER DEFAULT 0,
    last_accident_date DATE,
    last_accident_description TEXT,

    -- Inspections (array of dates)
    safety_inspection_dates DATE[],
    emissions_test_dates DATE[],
    mechanical_inspection_dates DATE[],

    -- Documents
    registration_document_url VARCHAR(500),
    insurance_document_url VARCHAR(500),
    inspection_certificate_url VARCHAR(500),
    vehicle_photo_url VARCHAR(500),
    manual_url VARCHAR(500),

    -- Environmental
    co2_emissions_per_km DECIMAL(6, 2), -- grams
    euro_emissions_standard VARCHAR(20), -- Euro 6, etc.
    green_vehicle BOOLEAN DEFAULT FALSE,

    -- Utilization Metrics
    total_trips_ytd INTEGER DEFAULT 0,
    total_hours_used_ytd INTEGER DEFAULT 0,
    utilization_rate_percent DECIMAL(5, 2),
    revenue_generated_ytd DECIMAL(12, 2),

    -- Alerts
    maintenance_alert BOOLEAN DEFAULT FALSE,
    insurance_expiry_alert BOOLEAN DEFAULT FALSE,
    registration_expiry_alert BOOLEAN DEFAULT FALSE,
    inspection_due_alert BOOLEAN DEFAULT FALSE,

    -- Notes
    internal_notes TEXT,
    driver_notes TEXT,
    guest_facing_description TEXT,

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
    CONSTRAINT vehicle_number_unique UNIQUE (tenant_id, property_id, vehicle_number),
    CONSTRAINT vehicle_license_unique UNIQUE (license_plate, registration_number),
    CONSTRAINT vehicle_capacity_check CHECK (passenger_capacity > 0),
    CONSTRAINT vehicle_wheelchair_check CHECK (
        wheelchair_capacity = 0 OR wheelchair_accessible = TRUE
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE vehicles IS 'Hotel transportation fleet management including shuttles, cars, and luxury vehicles';
COMMENT ON COLUMN vehicles.vehicle_id IS 'Unique vehicle identifier (UUID)';
COMMENT ON COLUMN vehicles.vehicle_number IS 'Internal fleet number (e.g., "SHUTTLE-01")';
COMMENT ON COLUMN vehicles.vin IS 'Vehicle Identification Number (VIN)';
COMMENT ON COLUMN vehicles.wheelchair_accessible IS 'TRUE if vehicle can accommodate wheelchairs';
COMMENT ON COLUMN vehicles.ownership_type IS 'OWNED, LEASED, CONTRACTED, or RENTAL';
COMMENT ON COLUMN vehicles.vehicle_status IS 'Current status: AVAILABLE, IN_USE, OUT_OF_SERVICE, MAINTENANCE';
COMMENT ON COLUMN vehicles.odometer_reading_km IS 'Current odometer reading in kilometers';
COMMENT ON COLUMN vehicles.next_service_due_km IS 'Odometer reading when next service is due';
COMMENT ON COLUMN vehicles.gps_tracker_installed IS 'TRUE if vehicle has GPS tracking for real-time location';
COMMENT ON COLUMN vehicles.last_gps_location IS 'Most recent GPS coordinates (JSONB: {lat, lng, timestamp})';
COMMENT ON COLUMN vehicles.metadata IS 'Custom fields for property-specific vehicle data';

\echo 'Vehicles table created successfully!'
