-- =====================================================
-- Indexes for event_bookings table
-- =====================================================

\c tartware

\echo 'Creating indexes for event_bookings...'

-- Primary lookup indexes
CREATE INDEX idx_event_bookings_tenant_property ON event_bookings(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_meeting_room ON event_bookings(meeting_room_id, event_date, start_time) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_date_range ON event_bookings(property_id, event_date, booking_status) WHERE is_deleted = FALSE;

-- Status indexes
CREATE INDEX idx_event_bookings_status ON event_bookings(property_id, booking_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_tentative ON event_bookings(property_id, event_date) WHERE is_deleted = FALSE AND booking_status = 'TENTATIVE';
CREATE INDEX idx_event_bookings_confirmed ON event_bookings(property_id, event_date) WHERE is_deleted = FALSE AND booking_status = 'CONFIRMED';

-- Guest/organizer indexes
CREATE INDEX idx_event_bookings_guest ON event_bookings(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_organizer_email ON event_bookings(organizer_email) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_company ON event_bookings(company_id) WHERE is_deleted = FALSE;

-- Reservation linkage
CREATE INDEX idx_event_bookings_reservation ON event_bookings(reservation_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_group_booking ON event_bookings(group_booking_id) WHERE is_deleted = FALSE;

-- Time-based indexes
CREATE INDEX idx_event_bookings_upcoming ON event_bookings(property_id, event_date, start_time) WHERE is_deleted = FALSE AND event_date >= CURRENT_DATE;
CREATE INDEX idx_event_bookings_today ON event_bookings(property_id, event_date) WHERE is_deleted = FALSE AND event_date = CURRENT_DATE;

-- Financial indexes
CREATE INDEX idx_event_bookings_folio ON event_bookings(folio_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_deposit_status ON event_bookings(property_id, deposit_due_date, deposit_received) WHERE is_deleted = FALSE AND deposit_received = FALSE;

-- Event type indexes
CREATE INDEX idx_event_bookings_type ON event_bookings(property_id, event_type, event_date) WHERE is_deleted = FALSE;

-- Recurring events
CREATE INDEX idx_event_bookings_recurring ON event_bookings(parent_event_id) WHERE is_deleted = FALSE AND recurring = TRUE;

-- Catering indexes
CREATE INDEX idx_event_bookings_catering ON event_bookings(property_id, event_date) WHERE is_deleted = FALSE AND catering_required = TRUE;

-- Setup tracking
CREATE INDEX idx_event_bookings_setup_pending ON event_bookings(property_id, event_date) WHERE is_deleted = FALSE AND setup_completed = FALSE AND event_date >= CURRENT_DATE;

-- JSONB indexes (GIN)
CREATE INDEX idx_event_bookings_equipment_gin ON event_bookings USING GIN (equipment_required) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_bookings_metadata_gin ON event_bookings USING GIN (metadata) WHERE is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_event_bookings_created ON event_bookings(created_at);
CREATE INDEX idx_event_bookings_updated ON event_bookings(updated_at);

\echo 'Indexes for event_bookings created successfully!'
