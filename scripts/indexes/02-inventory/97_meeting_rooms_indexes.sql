-- =====================================================
-- Indexes for meeting_rooms table
-- =====================================================

\c tartware

\echo 'Creating indexes for meeting_rooms...'

-- Primary lookup indexes
CREATE INDEX idx_meeting_rooms_tenant_property ON meeting_rooms(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_meeting_rooms_status ON meeting_rooms(property_id, room_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_meeting_rooms_name ON meeting_rooms(property_id, room_name) WHERE is_deleted = FALSE;

-- Capacity search indexes
CREATE INDEX idx_meeting_rooms_capacity ON meeting_rooms(property_id, max_capacity) WHERE is_deleted = FALSE AND room_status = 'AVAILABLE';
CREATE INDEX idx_meeting_rooms_theater_capacity ON meeting_rooms(property_id, theater_capacity) WHERE is_deleted = FALSE AND theater_capacity > 0;
CREATE INDEX idx_meeting_rooms_banquet_capacity ON meeting_rooms(property_id, banquet_capacity) WHERE is_deleted = FALSE AND banquet_capacity > 0;

-- Availability indexes
CREATE INDEX idx_meeting_rooms_available ON meeting_rooms(property_id, room_status) WHERE is_deleted = FALSE AND room_status IN ('AVAILABLE', 'MAINTENANCE');

CREATE INDEX idx_meeting_rooms_floor ON meeting_rooms(property_id, floor) WHERE is_deleted = FALSE;
CREATE INDEX idx_meeting_rooms_building ON meeting_rooms(property_id, building) WHERE is_deleted = FALSE;

CREATE INDEX idx_meeting_rooms_included_equipment_gin ON meeting_rooms USING GIN (included_equipment) WHERE is_deleted = FALSE;
CREATE INDEX idx_meeting_rooms_available_equipment_gin ON meeting_rooms USING GIN (available_equipment) WHERE is_deleted = FALSE;

-- Pricing indexes
CREATE INDEX idx_meeting_rooms_pricing ON meeting_rooms(property_id, half_day_rate, full_day_rate) WHERE is_deleted = FALSE AND room_status = 'AVAILABLE';

-- Audit indexes
CREATE INDEX idx_meeting_rooms_created ON meeting_rooms(created_at);
CREATE INDEX idx_meeting_rooms_updated ON meeting_rooms(updated_at);

\echo 'Indexes for meeting_rooms created successfully!'
