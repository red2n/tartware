-- =====================================================
-- 09_room_availability_indexes.sql
-- Indexes for availability.room_availability table
-- Performance optimization for high-volume availability queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for availability.room_availability table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_avail_tenant_id ON availability.room_availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_avail_property_id ON availability.room_availability(property_id);
CREATE INDEX IF NOT EXISTS idx_avail_room_type_id ON availability.room_availability(room_type_id);

-- Date lookup (critical for availability calendar)
CREATE INDEX IF NOT EXISTS idx_avail_date ON availability.room_availability(availability_date);

-- Composite index for availability lookup (most critical query)
CREATE INDEX IF NOT EXISTS idx_avail_property_type_date ON availability.room_availability(property_id, room_type_id, availability_date);

-- Date range queries (for calendar views)
CREATE INDEX IF NOT EXISTS idx_avail_property_date_range ON availability.room_availability(property_id, availability_date);
CREATE INDEX IF NOT EXISTS idx_avail_type_date_range ON availability.room_availability(room_type_id, availability_date);

-- Status filter
CREATE INDEX IF NOT EXISTS idx_avail_status ON availability.room_availability(status);
CREATE INDEX IF NOT EXISTS idx_avail_property_status_date ON availability.room_availability(property_id, status, availability_date);

-- Available rooms filter (for quick availability check)
CREATE INDEX IF NOT EXISTS idx_avail_available_rooms ON availability.room_availability(available_rooms) WHERE available_rooms > 0;
CREATE INDEX IF NOT EXISTS idx_avail_property_available ON availability.room_availability(property_id, availability_date, available_rooms)
    WHERE available_rooms > 0 AND stop_sell = false;

-- Stop sell flag
CREATE INDEX IF NOT EXISTS idx_avail_stop_sell ON availability.room_availability(stop_sell) WHERE stop_sell = true;

-- Restrictions
CREATE INDEX IF NOT EXISTS idx_avail_closed_arrival ON availability.room_availability(closed_to_arrival) WHERE closed_to_arrival = true;
CREATE INDEX IF NOT EXISTS idx_avail_closed_departure ON availability.room_availability(closed_to_departure) WHERE closed_to_departure = true;

-- Pricing (for yield management)
CREATE INDEX IF NOT EXISTS idx_avail_dynamic_price ON availability.room_availability(dynamic_price) WHERE dynamic_price IS NOT NULL;

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_avail_metadata_gin ON availability.room_availability USING GIN(metadata);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_avail_created_at ON availability.room_availability(created_at);
CREATE INDEX IF NOT EXISTS idx_avail_updated_at ON availability.room_availability(updated_at);

-- Composite for calendar queries (property + date range + status)
CREATE INDEX IF NOT EXISTS idx_avail_calendar ON availability.room_availability(property_id, availability_date, status, available_rooms);

-- Index for low inventory alerts
CREATE INDEX IF NOT EXISTS idx_avail_low_inventory ON availability.room_availability(property_id, room_type_id, availability_date, available_rooms)
    WHERE available_rooms <= 5 AND available_rooms > 0;

\echo '✓ Availability.room_availability indexes created successfully!'
