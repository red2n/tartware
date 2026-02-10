-- =====================================================
-- ota_configurations.sql
-- OTA Configurations Table
-- Industry Standard: Channel Manager integrations
-- Pattern: Store OTA API credentials, endpoints, and sync configuration
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- OTA_CONFIGURATIONS TABLE
-- Stores OTA (Online Travel Agency) API credentials,
-- endpoints, and configuration
-- =====================================================

CREATE TABLE IF NOT EXISTS ota_configurations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- OTA Identification
    ota_name VARCHAR(100) NOT NULL, -- 'Booking.com', 'Expedia', 'Airbnb', etc.
    ota_code VARCHAR(50) NOT NULL, -- 'BOOKING_COM', 'EXPEDIA', 'AIRBNB'

    -- API Configuration
    api_endpoint VARCHAR(500),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    hotel_id VARCHAR(100), -- OTA's property identifier

    -- Channel Manager
    channel_manager VARCHAR(100), -- 'Direct', 'SiteMinder', 'Channel Manager X'

    -- Status & Sync Settings
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT true,
    sync_frequency_minutes INTEGER DEFAULT 15,

    -- Sync Tracking
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'FAILED', 'IN_PROGRESS'
    sync_error_message TEXT,

    -- Feature Flags
    rate_push_enabled BOOLEAN DEFAULT true,
    availability_push_enabled BOOLEAN DEFAULT true,
    reservation_pull_enabled BOOLEAN DEFAULT true,

    -- Financial
    commission_percentage DECIMAL(5,2),
    currency_code VARCHAR(3) DEFAULT 'USD',

    -- Additional Configuration
    configuration_json JSONB, -- Additional OTA-specific settings

    -- Audit Fields
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_ota_config_commission CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    CONSTRAINT chk_ota_config_sync_frequency CHECK (sync_frequency_minutes > 0)
);

-- Add comments
COMMENT ON TABLE ota_configurations IS 'OTA API credentials and configuration for channel management';
COMMENT ON COLUMN ota_configurations.ota_name IS 'Human-readable OTA name';
COMMENT ON COLUMN ota_configurations.ota_code IS 'Unique code identifier for OTA';
COMMENT ON COLUMN ota_configurations.hotel_id IS 'Property identifier in OTA system';
COMMENT ON COLUMN ota_configurations.channel_manager IS 'Channel manager service if applicable';
COMMENT ON COLUMN ota_configurations.configuration_json IS 'OTA-specific configuration in JSON format';

\echo 'ota_configurations table created successfully!'

\echo 'ota_configurations table created successfully!'

\echo 'ota_configurations table created successfully!'
