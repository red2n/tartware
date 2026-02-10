-- =============================================
-- Smart Room Devices Table
-- =============================================
-- Description: IoT device registry and smart room management
-- Dependencies: properties, rooms
-- Category: IoT & Smart Rooms
-- =============================================

CREATE TABLE IF NOT EXISTS smart_room_devices (
    -- Primary Key
    device_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Room Association
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    location VARCHAR(255), -- "Room 101", "Lobby", "Pool Area"

    -- Device Information
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN (
        'smart_thermostat',
        'smart_lock',
        'lighting_control',
        'curtain_control',
        'tv',
        'voice_assistant',
        'occupancy_sensor',
        'motion_sensor',
        'door_sensor',
        'window_sensor',
        'smoke_detector',
        'co_detector',
        'leak_detector',
        'air_quality_monitor',
        'smart_mirror',
        'smart_shower',
        'mini_bar_sensor',
        'safe',
        'energy_monitor',
        'hub',
        'other'
    )),

    device_category VARCHAR(50) CHECK (device_category IN (
        'climate_control',
        'access_control',
        'lighting',
        'entertainment',
        'security',
        'environmental',
        'convenience',
        'energy_management'
    )),

    -- Hardware Details
    manufacturer VARCHAR(255),
    model_number VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    firmware_version VARCHAR(50),
    hardware_version VARCHAR(50),

    -- Network Configuration
    mac_address VARCHAR(17) UNIQUE,
    ip_address VARCHAR(45),
    network_type VARCHAR(50) CHECK (network_type IN (
        'wifi',
        'ethernet',
        'zigbee',
        'z_wave',
        'bluetooth',
        'thread',
        'matter',
        'proprietary'
    )),

    -- Connectivity
    is_online BOOLEAN DEFAULT FALSE,
    last_online_at TIMESTAMP WITHOUT TIME ZONE,
    signal_strength INTEGER, -- 0-100 or dBm
    battery_level INTEGER, -- 0-100 percentage
    is_battery_powered BOOLEAN DEFAULT FALSE,

    -- Installation
    installation_date DATE,
    installed_by UUID REFERENCES users(id),
    warranty_expiry_date DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active',
        'inactive',
        'maintenance',
        'offline',
        'error',
        'decommissioned'
    )),

    operational_status VARCHAR(50) CHECK (operational_status IN (
        'normal',
        'warning',
        'error',
        'critical'
    )),

    -- Device Capabilities
    supports_voice_control BOOLEAN DEFAULT FALSE,
    supports_remote_control BOOLEAN DEFAULT FALSE,
    supports_scheduling BOOLEAN DEFAULT FALSE,
    supports_automation BOOLEAN DEFAULT FALSE,

    -- Current State
    current_state JSONB, -- Device-specific state data
    -- Examples:
    -- Thermostat: {"temperature": 22, "mode": "cool", "target": 21}
    -- Lock: {"locked": true, "battery": 85}
    -- Light: {"on": true, "brightness": 75, "color": "#FFFFFF"}

    -- Configuration
    device_settings JSONB, -- Device-specific settings
    automation_rules JSONB, -- Automation configurations

    -- Energy Consumption
    power_consumption_watts DECIMAL(10,2),
    energy_usage_kwh DECIMAL(10,2) DEFAULT 0.00,

    -- Maintenance
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_interval_days INTEGER,

    maintenance_notes TEXT,
    issue_count INTEGER DEFAULT 0,

    -- Integration
    integration_platform VARCHAR(100), -- "Google Home", "Alexa", "HomeKit", "Custom"
    api_endpoint TEXT,
    api_key_reference VARCHAR(255), -- Reference to secure key storage

    -- Guest Interaction
    guest_controllable BOOLEAN DEFAULT TRUE,
    guest_visible BOOLEAN DEFAULT TRUE,
    requires_training BOOLEAN DEFAULT FALSE,

    -- Analytics
    total_activations INTEGER DEFAULT 0,
    last_activated_at TIMESTAMP WITHOUT TIME ZONE,
    average_daily_activations DECIMAL(10,2),

    -- Alerts
    alert_enabled BOOLEAN DEFAULT TRUE,
    alert_threshold JSONB, -- Device-specific thresholds
    last_alert_at TIMESTAMP WITHOUT TIME ZONE,

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    version BIGINT DEFAULT 0
);

-- =============================================
-- Room Energy Usage Table
-- =============================================

CREATE TABLE IF NOT EXISTS room_energy_usage (
    -- Primary Key
    usage_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Room
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

    -- Time Period
    measurement_date DATE NOT NULL,
    measurement_hour INTEGER CHECK (measurement_hour >= 0 AND measurement_hour <= 23),

    -- Occupancy Context
    is_occupied BOOLEAN DEFAULT FALSE,
    guest_id UUID REFERENCES guests(id),
    reservation_id UUID REFERENCES reservations(id),
    number_of_guests INTEGER,

    -- Energy Consumption
    total_energy_kwh DECIMAL(10,4) DEFAULT 0.0000,
    hvac_energy_kwh DECIMAL(10,4) DEFAULT 0.0000,
    lighting_energy_kwh DECIMAL(10,4) DEFAULT 0.0000,
    appliances_energy_kwh DECIMAL(10,4) DEFAULT 0.0000,
    other_energy_kwh DECIMAL(10,4) DEFAULT 0.0000,

    -- Environmental Conditions
    indoor_temperature DECIMAL(5,2),
    outdoor_temperature DECIMAL(5,2),
    indoor_humidity DECIMAL(5,2),
    outdoor_humidity DECIMAL(5,2),

    -- HVAC Settings
    hvac_mode VARCHAR(50), -- "cool", "heat", "auto", "off"
    target_temperature DECIMAL(5,2),
    fan_speed VARCHAR(50),
    hvac_runtime_minutes INTEGER,

    -- Lighting
    lights_on_count INTEGER DEFAULT 0,
    total_lighting_minutes INTEGER DEFAULT 0,

    -- Water Usage
    hot_water_liters DECIMAL(10,2) DEFAULT 0.00,
    cold_water_liters DECIMAL(10,2) DEFAULT 0.00,

    -- Cost
    energy_cost DECIMAL(10,2),
    water_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),

    -- Efficiency Metrics
    energy_per_guest DECIMAL(10,4) GENERATED ALWAYS AS (
        CASE
            WHEN number_of_guests > 0 THEN total_energy_kwh / number_of_guests
            ELSE NULL
        END
    ) STORED,

    cost_per_guest DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE
            WHEN number_of_guests > 0 THEN total_cost / number_of_guests
            ELSE NULL
        END
    ) STORED,

    -- Benchmarking
    property_average_kwh DECIMAL(10,4),
    variance_from_average DECIMAL(10,4),
    efficiency_rating VARCHAR(50) CHECK (efficiency_rating IN (
        'excellent',
        'good',
        'average',
        'poor',
        'very_poor'
    )),

    -- Alerts
    over_consumption_alert BOOLEAN DEFAULT FALSE,
    anomaly_detected BOOLEAN DEFAULT FALSE,
    anomaly_type VARCHAR(100),

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- =============================================
-- Guest Room Preferences Table
-- =============================================

CREATE TABLE IF NOT EXISTS guest_room_preferences (
    -- Primary Key
    preference_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Guest
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,

    -- Climate Preferences
    preferred_temperature DECIMAL(5,2),
    temperature_unit VARCHAR(1) CHECK (temperature_unit IN ('C', 'F')),
    preferred_hvac_mode VARCHAR(50) CHECK (preferred_hvac_mode IN (
        'cool',
        'heat',
        'auto',
        'eco'
    )),

    preferred_humidity DECIMAL(5,2),

    -- Lighting Preferences
    preferred_lighting_level INTEGER CHECK (preferred_lighting_level >= 0 AND preferred_lighting_level <= 100),
    preferred_color_temperature INTEGER, -- Kelvin (2700-6500)
    prefers_natural_light BOOLEAN DEFAULT TRUE,

    wake_up_lighting_time TIME,
    sleep_lighting_time TIME,

    -- Automation Preferences
    auto_curtains_open_time TIME,
    auto_curtains_close_time TIME,

    motion_sensor_enabled BOOLEAN DEFAULT TRUE,
    auto_lights_off_when_vacant BOOLEAN DEFAULT TRUE,

    -- Entertainment
    preferred_tv_channels TEXT[],
    preferred_streaming_services TEXT[],
    preferred_music_genre TEXT[],

    -- Voice Assistant
    voice_assistant_enabled BOOLEAN DEFAULT FALSE,
    voice_assistant_wake_word VARCHAR(50),
    voice_assistant_language VARCHAR(10),

    -- Accessibility
    accessibility_mode BOOLEAN DEFAULT FALSE,
    hearing_accessible BOOLEAN DEFAULT FALSE,
    mobility_accessible BOOLEAN DEFAULT FALSE,
    visual_accessible BOOLEAN DEFAULT FALSE,

    -- Privacy Settings
    do_not_disturb_default BOOLEAN DEFAULT FALSE,
    privacy_mode_enabled BOOLEAN DEFAULT FALSE,
    camera_disabled BOOLEAN DEFAULT FALSE,
    microphone_disabled BOOLEAN DEFAULT FALSE,

    -- Learning & Adaptation
    learning_mode_enabled BOOLEAN DEFAULT TRUE, -- Allow system to learn preferences
    last_learned_at TIMESTAMP WITHOUT TIME ZONE,

    -- Profile
    profile_name VARCHAR(100), -- "Business Travel", "Relaxation", "Family Trip"
    is_default_profile BOOLEAN DEFAULT TRUE,

    -- Device-Specific Preferences
    device_preferences JSONB, -- Preferences for specific device types

    -- Notes
    special_requests TEXT,
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- =============================================
-- Device Events Log
-- =============================================

CREATE TABLE IF NOT EXISTS device_events_log (
    -- Primary Key
    event_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Device
    device_id UUID NOT NULL REFERENCES smart_room_devices(device_id) ON DELETE CASCADE,

    -- Event Details
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'state_change',
        'activation',
        'deactivation',
        'error',
        'warning',
        'maintenance',
        'update',
        'connection',
        'disconnection',
        'alert',
        'guest_interaction',
        'automation_triggered'
    )),

    event_timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Event Data
    previous_state JSONB,
    new_state JSONB,
    event_data JSONB,

    -- Trigger
    triggered_by VARCHAR(50) CHECK (triggered_by IN (
        'guest',
        'staff',
        'automation',
        'schedule',
        'sensor',
        'system',
        'api',
        'voice_command'
    )),

    triggered_by_user_id UUID REFERENCES users(id),
    triggered_by_guest_id UUID REFERENCES guests(id),

    -- Error Information
    error_code VARCHAR(50),
    error_message TEXT,
    severity VARCHAR(50) CHECK (severity IN (
        'info',
        'warning',
        'error',
        'critical'
    )),

    -- Response
    action_taken TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITHOUT TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


COMMENT ON TABLE smart_room_devices IS 'IoT device registry for smart room devices (thermostats, locks, sensors, etc.)';
COMMENT ON TABLE room_energy_usage IS 'Per-room energy consumption tracking with occupancy correlation and efficiency metrics';
COMMENT ON TABLE guest_room_preferences IS 'Guest preferences for smart room automation (temperature, lighting, privacy, etc.)';
COMMENT ON TABLE device_events_log IS 'Comprehensive event log for all smart device state changes and interactions';
COMMENT ON COLUMN smart_room_devices.current_state IS 'JSON containing device-specific current state (temperature, lock status, brightness, etc.)';
COMMENT ON COLUMN room_energy_usage.energy_per_guest IS 'Energy consumption normalized by number of guests (computed)';
COMMENT ON COLUMN guest_room_preferences.learning_mode_enabled IS 'Allow system to learn and adapt to guest behavior patterns';

\echo 'smart_room_devices table created successfully!'
