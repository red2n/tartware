-- =====================================================
-- Indexes for shuttle_schedules table
-- =====================================================

\c tartware

\echo 'Creating indexes for shuttle_schedules...'

-- Primary lookup indexes
CREATE INDEX idx_shuttle_schedules_tenant_property ON shuttle_schedules(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_code ON shuttle_schedules(tenant_id, property_id, schedule_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_name ON shuttle_schedules(property_id, schedule_name) WHERE is_deleted = FALSE;

-- Route type indexes
CREATE INDEX idx_shuttle_schedules_route_type ON shuttle_schedules(property_id, route_type, schedule_status) WHERE is_deleted = FALSE;

-- Status indexes
CREATE INDEX idx_shuttle_schedules_active ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND schedule_status = 'ACTIVE';
CREATE INDEX idx_shuttle_schedules_operational ON shuttle_schedules(property_id, schedule_status, active_from_date, active_to_date) WHERE is_deleted = FALSE;

-- Schedule type indexes
CREATE INDEX idx_shuttle_schedules_schedule_type ON shuttle_schedules(property_id, schedule_type, schedule_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_fixed_time ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND schedule_type = 'FIXED_TIME';
CREATE INDEX idx_shuttle_schedules_interval ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND schedule_type = 'INTERVAL';

-- Operating days indexes (find schedules operating today)
CREATE INDEX idx_shuttle_schedules_monday ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND operates_monday = TRUE;
CREATE INDEX idx_shuttle_schedules_tuesday ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND operates_tuesday = TRUE;
CREATE INDEX idx_shuttle_schedules_wednesday ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND operates_wednesday = TRUE;
CREATE INDEX idx_shuttle_schedules_thursday ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND operates_thursday = TRUE;
CREATE INDEX idx_shuttle_schedules_friday ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND operates_friday = TRUE;
CREATE INDEX idx_shuttle_schedules_saturday ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND operates_saturday = TRUE;
CREATE INDEX idx_shuttle_schedules_sunday ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND operates_sunday = TRUE;

-- Seasonal schedules
CREATE INDEX idx_shuttle_schedules_seasonal ON shuttle_schedules(property_id, seasonal, season_start_date, season_end_date) WHERE is_deleted = FALSE AND seasonal = TRUE;
CREATE INDEX idx_shuttle_schedules_season_active ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND seasonal = TRUE AND season_start_date IS NOT NULL AND season_end_date IS NOT NULL;

-- Vehicle assignment
CREATE INDEX idx_shuttle_schedules_vehicle ON shuttle_schedules(default_vehicle_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_vehicle_type ON shuttle_schedules(property_id, vehicle_type_required, schedule_status) WHERE is_deleted = FALSE;

-- Driver assignment
CREATE INDEX idx_shuttle_schedules_driver ON shuttle_schedules(default_driver_id) WHERE is_deleted = FALSE;

-- Capacity management
CREATE INDEX idx_shuttle_schedules_capacity ON shuttle_schedules(property_id, max_passengers_per_trip, schedule_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_reservation_required ON shuttle_schedules(property_id, reservation_required, schedule_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_wheelchair ON shuttle_schedules(property_id, wheelchair_spots_available, schedule_status) WHERE is_deleted = FALSE AND wheelchair_spots_available > 0;

-- Service type
CREATE INDEX idx_shuttle_schedules_service_type ON shuttle_schedules(property_id, service_type, schedule_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_complimentary ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND service_type = 'COMPLIMENTARY';
CREATE INDEX idx_shuttle_schedules_paid ON shuttle_schedules(property_id, schedule_status) WHERE is_deleted = FALSE AND service_type = 'PAID';

-- Guest eligibility
CREATE INDEX idx_shuttle_schedules_guest_only ON shuttle_schedules(property_id, guest_only, schedule_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_public ON shuttle_schedules(property_id, public_access, schedule_status) WHERE is_deleted = FALSE AND public_access = TRUE;

-- Real-time tracking
CREATE INDEX idx_shuttle_schedules_tracking ON shuttle_schedules(property_id, real_time_tracking_enabled, schedule_status) WHERE is_deleted = FALSE AND real_time_tracking_enabled = TRUE;

-- Booking availability
CREATE INDEX idx_shuttle_schedules_bookable ON shuttle_schedules(property_id, available_for_booking, schedule_status) WHERE is_deleted = FALSE AND available_for_booking = TRUE;
CREATE INDEX idx_shuttle_schedules_website ON shuttle_schedules(property_id, displayed_on_website, schedule_status) WHERE is_deleted = FALSE AND displayed_on_website = TRUE;
CREATE INDEX idx_shuttle_schedules_app ON shuttle_schedules(property_id, displayed_on_app, schedule_status) WHERE is_deleted = FALSE AND displayed_on_app = TRUE;

-- Notification settings
CREATE INDEX idx_shuttle_schedules_notifications ON shuttle_schedules(property_id, automated_notifications, schedule_status) WHERE is_deleted = FALSE AND automated_notifications = TRUE;

-- Performance metrics
CREATE INDEX idx_shuttle_schedules_performance ON shuttle_schedules(property_id, on_time_performance_percent DESC) WHERE is_deleted = FALSE AND schedule_status = 'ACTIVE';
CREATE INDEX idx_shuttle_schedules_satisfaction ON shuttle_schedules(property_id, guest_satisfaction_rating DESC) WHERE is_deleted = FALSE AND schedule_status = 'ACTIVE';

-- Utilization
CREATE INDEX idx_shuttle_schedules_occupancy ON shuttle_schedules(property_id, average_occupancy_percent DESC) WHERE is_deleted = FALSE AND schedule_status = 'ACTIVE';

-- Alerts
CREATE INDEX idx_shuttle_schedules_alerts ON shuttle_schedules(property_id) WHERE is_deleted = FALSE AND (
    maintenance_alert = TRUE OR
    vehicle_unavailable_alert = TRUE
);

-- JSONB indexes (GIN)
CREATE INDEX idx_shuttle_schedules_stops_gin ON shuttle_schedules USING GIN (route_stops) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_route_path_gin ON shuttle_schedules USING GIN (preferred_route_path) WHERE is_deleted = FALSE;
CREATE INDEX idx_shuttle_schedules_metadata_gin ON shuttle_schedules USING GIN (metadata) WHERE is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_shuttle_schedules_created ON shuttle_schedules(created_at);
CREATE INDEX idx_shuttle_schedules_updated ON shuttle_schedules(updated_at);

\echo 'Indexes for shuttle_schedules created successfully!'
