-- =====================================================
-- room_availability.sql
-- Room Availability Table (Availability Schema)
-- Industry Standard: Real-time inventory management
-- Pattern: Oracle OPERA Availability, Cloudbeds Availability
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating availability.room_availability table...'

-- =====================================================
-- AVAILABILITY.ROOM_AVAILABILITY TABLE
-- High-volume table: One row per room type per date
-- Real-time inventory tracking
-- Separate schema for performance
-- =====================================================

CREATE TABLE IF NOT EXISTS availability.room_availability (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    room_type_id UUID NOT NULL,

    -- Date
    availability_date DATE NOT NULL,

    -- Inventory
    total_rooms INTEGER NOT NULL DEFAULT 0,
    available_rooms INTEGER NOT NULL DEFAULT 0,
    reserved_rooms INTEGER NOT NULL DEFAULT 0,
    blocked_rooms INTEGER NOT NULL DEFAULT 0,
    out_of_order_rooms INTEGER NOT NULL DEFAULT 0,

    -- Pricing (can override rate table for dynamic pricing)
    base_price DECIMAL(15,2),
    dynamic_price DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Restrictions
    min_length_of_stay INTEGER DEFAULT 1,
    max_length_of_stay INTEGER,
    closed_to_arrival BOOLEAN DEFAULT false,
    closed_to_departure BOOLEAN DEFAULT false,
    stop_sell BOOLEAN DEFAULT false,

    -- Status
    status availability_status NOT NULL DEFAULT 'available',

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT room_avail_unique UNIQUE (property_id, room_type_id, availability_date),
    CONSTRAINT room_avail_inventory_check CHECK (
        available_rooms + reserved_rooms + blocked_rooms + out_of_order_rooms <= total_rooms
    ),
    CONSTRAINT room_avail_counts_check CHECK (
        available_rooms >= 0 AND
        reserved_rooms >= 0 AND
        blocked_rooms >= 0 AND
        out_of_order_rooms >= 0 AND
        total_rooms >= 0
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE availability.room_availability IS 'Real-time room inventory by date (high-volume)';
COMMENT ON COLUMN availability.room_availability.id IS 'Unique availability record identifier (UUID)';
COMMENT ON COLUMN availability.room_availability.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN availability.room_availability.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN availability.room_availability.room_type_id IS 'Reference to room_types.id';
COMMENT ON COLUMN availability.room_availability.availability_date IS 'Date for this availability snapshot';
COMMENT ON COLUMN availability.room_availability.total_rooms IS 'Total physical rooms of this type';
COMMENT ON COLUMN availability.room_availability.available_rooms IS 'Rooms available for sale';
COMMENT ON COLUMN availability.room_availability.reserved_rooms IS 'Rooms with confirmed reservations';
COMMENT ON COLUMN availability.room_availability.blocked_rooms IS 'Rooms blocked (not for sale)';
COMMENT ON COLUMN availability.room_availability.out_of_order_rooms IS 'Rooms out of service';
COMMENT ON COLUMN availability.room_availability.base_price IS 'Base price for this date';
COMMENT ON COLUMN availability.room_availability.dynamic_price IS 'Dynamic/yield management price';
COMMENT ON COLUMN availability.room_availability.stop_sell IS 'Stop selling this room type for this date';
COMMENT ON COLUMN availability.room_availability.status IS 'ENUM: available, low_availability, sold_out, closed';

\echo 'Availability.room_availability table created successfully!'
