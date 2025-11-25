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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique daily inventory snapshot identifier

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL, -- FK tenants.id
    property_id UUID NOT NULL, -- FK properties.id
    room_type_id UUID NOT NULL, -- FK room_types.id
    rate_plan_id UUID NOT NULL, -- FK rates.id (rate plan dimension)

    -- Date
    availability_date DATE NOT NULL, -- Calendar date for this snapshot

    -- Inventory
    base_capacity INTEGER NOT NULL DEFAULT 0, -- Physical rooms available for the room type
    available_rooms INTEGER NOT NULL DEFAULT 0, -- Rooms currently available for sale
    booked_rooms INTEGER NOT NULL DEFAULT 0, -- Rooms tied to confirmed bookings
    blocked_rooms INTEGER NOT NULL DEFAULT 0, -- Manually blocked inventory (manager holds, maintenance windows)
    housekeeping_hold_rooms INTEGER NOT NULL DEFAULT 0, -- Rooms temporarily held by housekeeping
    out_of_order_rooms INTEGER NOT NULL DEFAULT 0, -- Rooms out of service
    oversell_limit INTEGER NOT NULL DEFAULT 0, -- Allowable oversell buffer for this date

    -- Distribution controls
    channel_allocations JSONB NOT NULL DEFAULT '{}'::jsonb, -- Per-channel allocations (Booking.com, Expedia, etc.)

    -- Pricing (can override rate table for dynamic pricing)
    base_price DECIMAL(15, 2), -- Base price for the date
    dynamic_price DECIMAL(15, 2), -- Yield-managed override price
    rate_override DECIMAL(15, 2), -- Explicit override pushed by revenue manager/channel
    currency VARCHAR(3) DEFAULT 'USD', -- Pricing currency

    -- Restrictions
    min_length_of_stay INTEGER DEFAULT 1, -- Minimum stay restriction for date
    max_length_of_stay INTEGER, -- Maximum stay restriction
    min_stay_override INTEGER, -- Override for minimum stay from channels/rate management
    max_stay_override INTEGER, -- Override for maximum stay from channels/rate management
    closed_to_arrival BOOLEAN DEFAULT false, -- Block new arrivals
    closed_to_departure BOOLEAN DEFAULT false, -- Block departures
    stop_sell BOOLEAN DEFAULT false, -- Mark as stop-sell for OTA syncing
    is_closed BOOLEAN DEFAULT false, -- Hard close flag for inventory freezes
    release_back_minutes INTEGER DEFAULT 120, -- When to release held inventory back to base pool

    -- Status
    status availability_status NOT NULL DEFAULT 'AVAILABLE', -- Aggregated availability indicator

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Extension slot for channel manager sync metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP, -- Last update timestamp
    created_by VARCHAR(100), -- Creator identifier
    updated_by VARCHAR(100), -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
    deleted_at TIMESTAMP, -- Deletion timestamp
    deleted_by VARCHAR(100), -- Deleting user identifier

    -- Optimistic Locking
    version BIGINT NOT NULL DEFAULT 0, -- Version counter to prevent race conditions

    -- Constraints
    CONSTRAINT room_avail_unique UNIQUE (property_id, room_type_id, rate_plan_id, availability_date), -- One row per date/type/rate plan
    CONSTRAINT room_avail_inventory_check CHECK (
        available_rooms + booked_rooms + blocked_rooms + housekeeping_hold_rooms + out_of_order_rooms <= base_capacity + oversell_limit
    ), -- Inventory counts cannot exceed physical + oversell headroom
    CONSTRAINT room_avail_counts_check CHECK (
        base_capacity >= 0 AND
        available_rooms >= 0 AND
        booked_rooms >= 0 AND
        blocked_rooms >= 0 AND
        housekeeping_hold_rooms >= 0 AND
        out_of_order_rooms >= 0 AND
        oversell_limit >= 0
    ),
    CONSTRAINT room_avail_los_check CHECK (
        (max_length_of_stay IS NULL OR max_length_of_stay >= min_length_of_stay)
        AND (min_stay_override IS NULL OR min_stay_override >= 1)
        AND (max_stay_override IS NULL OR min_stay_override IS NULL OR max_stay_override >= min_stay_override)
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

COMMENT ON COLUMN availability.room_availability.rate_plan_id IS 'Reference to rates.id (rate plan dimension)';

COMMENT ON COLUMN availability.room_availability.availability_date IS 'Date for this availability snapshot';

COMMENT ON COLUMN availability.room_availability.base_capacity IS 'Total physical rooms of this type before operational holds';

COMMENT ON COLUMN availability.room_availability.available_rooms IS 'Rooms available for sale';

COMMENT ON COLUMN availability.room_availability.booked_rooms IS 'Rooms with confirmed reservations';

COMMENT ON COLUMN availability.room_availability.blocked_rooms IS 'Rooms blocked (not for sale)';

COMMENT ON COLUMN availability.room_availability.housekeeping_hold_rooms IS 'Rooms on housekeeping hold (OOO but short-lived)';

COMMENT ON COLUMN availability.room_availability.out_of_order_rooms IS 'Rooms out of service';

COMMENT ON COLUMN availability.room_availability.channel_allocations IS 'JSON blob storing per-channel allocations/limits';

COMMENT ON COLUMN availability.room_availability.base_price IS 'Base price for this date';

COMMENT ON COLUMN availability.room_availability.dynamic_price IS 'Dynamic/yield management price';

COMMENT ON COLUMN availability.room_availability.rate_override IS 'Manual override pushed from revenue/channel systems';

COMMENT ON COLUMN availability.room_availability.min_stay_override IS 'Overrides default minimum length-of-stay rules';

COMMENT ON COLUMN availability.room_availability.max_stay_override IS 'Overrides default maximum length-of-stay rules';

COMMENT ON COLUMN availability.room_availability.stop_sell IS 'Stop selling this room type for this date';

COMMENT ON COLUMN availability.room_availability.is_closed IS 'Hard close flag (CTA/CTD + rate close)';

COMMENT ON COLUMN availability.room_availability.version IS 'Optimistic locking counter for event-driven upserts';

COMMENT ON COLUMN availability.room_availability.status IS 'ENUM: available, low_availability, sold_out, closed';

\echo 'Availability.room_availability table created successfully!'
