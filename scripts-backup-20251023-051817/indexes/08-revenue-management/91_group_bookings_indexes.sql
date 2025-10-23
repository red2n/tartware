-- =============================================
-- Indexes for 91_group_bookings
-- =============================================

CREATE INDEX idx_group_bookings_tenant ON group_bookings(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_property ON group_bookings(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_dates ON group_bookings(arrival_date, departure_date) WHERE is_active = TRUE;
CREATE INDEX idx_group_bookings_cutoff ON group_bookings(cutoff_date) WHERE block_status IN ('tentative', 'definite');
CREATE INDEX idx_group_bookings_status ON group_bookings(block_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_company ON group_bookings(company_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_code ON group_bookings(group_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_room_blocks_booking ON group_room_blocks(group_booking_id);
CREATE INDEX idx_group_room_blocks_date ON group_room_blocks(block_date, block_status);
CREATE INDEX idx_group_room_blocks_room_type ON group_room_blocks(room_type_id);
CREATE INDEX idx_group_room_blocks_availability ON group_room_blocks(block_date) WHERE blocked_rooms > picked_rooms;
