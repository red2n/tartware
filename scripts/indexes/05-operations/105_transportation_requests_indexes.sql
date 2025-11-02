-- =====================================================
-- Indexes for transportation_requests table
-- =====================================================

\c tartware

\echo 'Creating indexes for transportation_requests...'

-- Primary lookup indexes
CREATE INDEX idx_transport_requests_tenant_property ON transportation_requests(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_number ON transportation_requests(tenant_id, property_id, request_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_guest ON transportation_requests(guest_id, requested_pickup_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_reservation ON transportation_requests(reservation_id) WHERE is_deleted = FALSE;

-- Status indexes
CREATE INDEX idx_transport_requests_status ON transportation_requests(property_id, request_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_pending ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND request_status = 'PENDING';
CREATE INDEX idx_transport_requests_confirmed ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND request_status = 'CONFIRMED';
CREATE INDEX idx_transport_requests_active ON transportation_requests(property_id, request_status) WHERE is_deleted = FALSE AND request_status IN ('CONFIRMED', 'ASSIGNED', 'DISPATCHED', 'EN_ROUTE');

-- Request type indexes
CREATE INDEX idx_transport_requests_type ON transportation_requests(property_id, request_type, requested_pickup_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_airport ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND request_type IN ('AIRPORT_ARRIVAL', 'AIRPORT_DEPARTURE');

-- Pickup date/time indexes
CREATE INDEX idx_transport_requests_pickup_date ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_today ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND DATE(requested_pickup_datetime) = CURRENT_DATE;
CREATE INDEX idx_transport_requests_upcoming ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND requested_pickup_datetime >= CURRENT_TIMESTAMP;

-- Vehicle assignment
CREATE INDEX idx_transport_requests_vehicle ON transportation_requests(vehicle_id, requested_pickup_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_unassigned ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND vehicle_id IS NULL AND request_status IN ('CONFIRMED', 'PENDING');

-- Driver assignment
CREATE INDEX idx_transport_requests_driver ON transportation_requests(driver_id, requested_pickup_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_driver_today ON transportation_requests(driver_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND DATE(requested_pickup_datetime) = CURRENT_DATE;

-- Dispatch tracking
CREATE INDEX idx_transport_requests_dispatched ON transportation_requests(property_id, dispatch_time) WHERE is_deleted = FALSE AND dispatched = TRUE;
CREATE INDEX idx_transport_requests_dispatch_pending ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND dispatched = FALSE AND request_status = 'ASSIGNED';

-- Flight tracking
CREATE INDEX idx_transport_requests_flight ON transportation_requests(flight_number, requested_pickup_datetime) WHERE is_deleted = FALSE AND is_flight_related = TRUE;
CREATE INDEX idx_transport_requests_flight_tracking ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND flight_tracking_enabled = TRUE;

-- Confirmation tracking
CREATE INDEX idx_transport_requests_unconfirmed ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND confirmation_sent = FALSE;

-- Completion tracking
CREATE INDEX idx_transport_requests_completed ON transportation_requests(property_id, completed_datetime) WHERE is_deleted = FALSE AND request_status = 'COMPLETED';
CREATE INDEX idx_transport_requests_incomplete ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND requested_pickup_datetime < CURRENT_TIMESTAMP AND request_status NOT IN ('COMPLETED', 'CANCELLED', 'NO_SHOW');

-- Special needs
CREATE INDEX idx_transport_requests_wheelchair ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND wheelchair_required = TRUE;
CREATE INDEX idx_transport_requests_child_seat ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND child_seat_required = TRUE;

-- Service type
CREATE INDEX idx_transport_requests_service_type ON transportation_requests(property_id, service_type, requested_pickup_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_complimentary ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND complimentary = TRUE;

-- Billing indexes
CREATE INDEX idx_transport_requests_folio ON transportation_requests(folio_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_folio_pending ON transportation_requests(property_id, charge_to_room, posted_to_folio) WHERE is_deleted = FALSE AND charge_to_room = TRUE AND posted_to_folio = FALSE;
CREATE INDEX idx_transport_requests_payment_pending ON transportation_requests(property_id, payment_status) WHERE is_deleted = FALSE AND payment_status != 'PAID';

-- VIP service
CREATE INDEX idx_transport_requests_vip ON transportation_requests(property_id, vip_service, requested_pickup_datetime) WHERE is_deleted = FALSE AND vip_service = TRUE;
CREATE INDEX idx_transport_requests_meet_greet ON transportation_requests(property_id, meet_and_greet, requested_pickup_datetime) WHERE is_deleted = FALSE AND meet_and_greet = TRUE;

-- Third-party service
CREATE INDEX idx_transport_requests_third_party ON transportation_requests(property_id, third_party_service) WHERE is_deleted = FALSE AND third_party_service = TRUE;
CREATE INDEX idx_transport_requests_third_party_provider ON transportation_requests(third_party_provider, requested_pickup_datetime) WHERE is_deleted = FALSE;

-- Communication tracking
CREATE INDEX idx_transport_requests_sms_pending ON transportation_requests(property_id, sms_sent, requested_pickup_datetime) WHERE is_deleted = FALSE AND sms_sent = FALSE;
CREATE INDEX idx_transport_requests_reminder_pending ON transportation_requests(property_id, reminder_sent, requested_pickup_datetime) WHERE is_deleted = FALSE AND reminder_sent = FALSE AND requested_pickup_datetime > CURRENT_TIMESTAMP;

-- Real-time tracking
CREATE INDEX idx_transport_requests_tracking ON transportation_requests(property_id, real_time_tracking_enabled) WHERE is_deleted = FALSE AND real_time_tracking_enabled = TRUE;

-- Rating & feedback
CREATE INDEX idx_transport_requests_rated ON transportation_requests(property_id, guest_rating, completed_datetime) WHERE is_deleted = FALSE AND guest_rating IS NOT NULL;
CREATE INDEX idx_transport_requests_low_rating ON transportation_requests(property_id, guest_rating, completed_datetime) WHERE is_deleted = FALSE AND guest_rating <= 3;

-- Issues reported
CREATE INDEX idx_transport_requests_issues ON transportation_requests(property_id, issues_reported, requested_pickup_datetime) WHERE is_deleted = FALSE AND issues_reported = TRUE;

-- Cancellation tracking
CREATE INDEX idx_transport_requests_cancelled ON transportation_requests(property_id, cancellation_datetime) WHERE is_deleted = FALSE AND request_status = 'CANCELLED';
CREATE INDEX idx_transport_requests_no_show ON transportation_requests(property_id, requested_pickup_datetime) WHERE is_deleted = FALSE AND no_show_recorded = TRUE;

-- Recurring requests
CREATE INDEX idx_transport_requests_recurring ON transportation_requests(parent_request_id) WHERE is_deleted = FALSE AND recurring = TRUE;

-- Package/promotion
CREATE INDEX idx_transport_requests_package ON transportation_requests(package_id) WHERE is_deleted = FALSE AND package_included = TRUE;
CREATE INDEX idx_transport_requests_promo ON transportation_requests(promotional_code, requested_pickup_datetime) WHERE is_deleted = FALSE;

-- Environmental
CREATE INDEX idx_transport_requests_carbon_offset ON transportation_requests(property_id, carbon_offset_offered, carbon_offset_accepted) WHERE is_deleted = FALSE AND carbon_offset_offered = TRUE;

-- JSONB indexes (GIN)
CREATE INDEX idx_transport_requests_pickup_coord_gin ON transportation_requests USING GIN (pickup_coordinates) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_dropoff_coord_gin ON transportation_requests USING GIN (dropoff_coordinates) WHERE is_deleted = FALSE;
CREATE INDEX idx_transport_requests_current_location_gin ON transportation_requests USING GIN (current_location) WHERE is_deleted = FALSE AND current_location IS NOT NULL;
CREATE INDEX idx_transport_requests_metadata_gin ON transportation_requests USING GIN (metadata) WHERE is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_transport_requests_created ON transportation_requests(created_at);
CREATE INDEX idx_transport_requests_updated ON transportation_requests(updated_at);

\echo 'Indexes for transportation_requests created successfully!'
