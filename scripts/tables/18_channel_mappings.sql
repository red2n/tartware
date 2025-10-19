-- =====================================================
-- channel_mappings.sql
-- Channel Mappings Table
-- Industry Standard: OTA/Channel Manager integration
-- Pattern: Channel Manager API, Distribution Mapping
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating channel_mappings table...'

-- =====================================================
-- CHANNEL_MAPPINGS TABLE
-- Map property entities to external channel IDs
-- OTA integration (Booking.com, Expedia, Airbnb)
-- =====================================================

CREATE TABLE IF NOT EXISTS channel_mappings (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Channel Information
    channel_name VARCHAR(100) NOT NULL,
    channel_code VARCHAR(50) NOT NULL,

    -- Entity Mapping
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,

    -- External Reference
    external_id VARCHAR(255) NOT NULL,
    external_code VARCHAR(100),

    -- Mapping Details
    mapping_config JSONB DEFAULT '{
        "sync": true,
        "pushRates": true,
        "pushAvailability": true,
        "pullReservations": true,
        "commission": 0
    }'::jsonb,

    -- Sync Status
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT channel_mappings_unique UNIQUE (property_id, channel_code, entity_type, entity_id),
    CONSTRAINT channel_mappings_external_unique UNIQUE (channel_code, external_id)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE channel_mappings IS 'Map property entities to external channel/OTA IDs';
COMMENT ON COLUMN channel_mappings.id IS 'Unique mapping identifier (UUID)';
COMMENT ON COLUMN channel_mappings.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN channel_mappings.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN channel_mappings.channel_name IS 'Channel name (Booking.com, Expedia, Airbnb, etc.)';
COMMENT ON COLUMN channel_mappings.channel_code IS 'Internal channel code (BOOKING_COM, EXPEDIA, AIRBNB)';
COMMENT ON COLUMN channel_mappings.entity_type IS 'Entity: property, room_type, rate, service';
COMMENT ON COLUMN channel_mappings.entity_id IS 'UUID of local entity';
COMMENT ON COLUMN channel_mappings.external_id IS 'External channel entity ID';
COMMENT ON COLUMN channel_mappings.external_code IS 'External channel entity code';
COMMENT ON COLUMN channel_mappings.mapping_config IS 'Sync configuration (JSONB)';
COMMENT ON COLUMN channel_mappings.last_sync_at IS 'Last successful sync timestamp';
COMMENT ON COLUMN channel_mappings.last_sync_status IS 'Status: success, error, pending';
COMMENT ON COLUMN channel_mappings.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Channel_mappings table created successfully!'
