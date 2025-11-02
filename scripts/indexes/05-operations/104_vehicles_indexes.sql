-- =====================================================
-- Indexes for vehicles table
-- =====================================================

\c tartware

\echo 'Creating indexes for vehicles...'

-- Primary lookup indexes
CREATE INDEX idx_vehicles_tenant_property ON vehicles(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_number ON vehicles(tenant_id, property_id, vehicle_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_vin ON vehicles(vin) WHERE is_deleted = FALSE AND vin IS NOT NULL;

-- Status indexes
CREATE INDEX idx_vehicles_status ON vehicles(property_id, vehicle_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_available ON vehicles(property_id, vehicle_type, operational) WHERE is_deleted = FALSE AND vehicle_status = 'AVAILABLE' AND operational = TRUE;

-- Vehicle type indexes
CREATE INDEX idx_vehicles_type ON vehicles(property_id, vehicle_type, vehicle_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_category ON vehicles(property_id, vehicle_category, vehicle_status) WHERE is_deleted = FALSE;

-- Capacity search
CREATE INDEX idx_vehicles_capacity ON vehicles(property_id, passenger_capacity, vehicle_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_wheelchair ON vehicles(property_id, wheelchair_accessible, wheelchair_capacity) WHERE is_deleted = FALSE AND wheelchair_accessible = TRUE;

-- Ownership indexes
CREATE INDEX idx_vehicles_ownership ON vehicles(property_id, ownership_type) WHERE is_deleted = FALSE;

-- Maintenance tracking
CREATE INDEX idx_vehicles_next_service ON vehicles(property_id, next_service_due_date) WHERE is_deleted = FALSE AND operational = TRUE;
CREATE INDEX idx_vehicles_service_overdue ON vehicles(property_id, next_service_due_date) WHERE is_deleted = FALSE AND next_service_due_date < CURRENT_DATE AND operational = TRUE;
CREATE INDEX idx_vehicles_service_due_km ON vehicles(property_id, next_service_due_km, odometer_reading_km) WHERE is_deleted = FALSE AND track_inventory = TRUE;

-- Compliance/expiration indexes
CREATE INDEX idx_vehicles_insurance_expiry ON vehicles(property_id, insurance_expiration_date) WHERE is_deleted = FALSE AND insurance_expiration_date IS NOT NULL;
CREATE INDEX idx_vehicles_registration_expiry ON vehicles(property_id, registration_expiration_date) WHERE is_deleted = FALSE AND registration_expiration_date IS NOT NULL;
CREATE INDEX idx_vehicles_inspection_due ON vehicles(property_id, inspection_due_date) WHERE is_deleted = FALSE AND inspection_due_date IS NOT NULL;

-- Expiring soon (alerts)
CREATE INDEX idx_vehicles_expiring_soon ON vehicles(property_id) WHERE is_deleted = FALSE AND (
    insurance_expiration_date <= CURRENT_DATE + INTERVAL '30 days' OR
    registration_expiration_date <= CURRENT_DATE + INTERVAL '30 days' OR
    inspection_due_date <= CURRENT_DATE + INTERVAL '30 days'
);

-- Driver assignment
CREATE INDEX idx_vehicles_default_driver ON vehicles(default_driver_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_current_driver ON vehicles(current_driver_id) WHERE is_deleted = FALSE AND current_driver_id IS NOT NULL;

-- GPS tracking
CREATE INDEX idx_vehicles_tracked ON vehicles(property_id, gps_tracker_installed, real_time_tracking) WHERE is_deleted = FALSE AND gps_tracker_installed = TRUE;

-- Fuel type
CREATE INDEX idx_vehicles_fuel_type ON vehicles(property_id, fuel_type, vehicle_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_vehicles_electric ON vehicles(property_id, vehicle_status) WHERE is_deleted = FALSE AND fuel_type IN ('ELECTRIC', 'HYBRID', 'PLUG_IN_HYBRID');

-- Environmental
CREATE INDEX idx_vehicles_green ON vehicles(property_id, green_vehicle) WHERE is_deleted = FALSE AND green_vehicle = TRUE;

-- Utilization metrics
CREATE INDEX idx_vehicles_utilization ON vehicles(property_id, utilization_rate_percent DESC) WHERE is_deleted = FALSE AND vehicle_status = 'AVAILABLE';

-- Alerts
CREATE INDEX idx_vehicles_alerts ON vehicles(property_id) WHERE is_deleted = FALSE AND (
    maintenance_alert = TRUE OR
    insurance_expiry_alert = TRUE OR
    registration_expiry_alert = TRUE OR
    inspection_due_alert = TRUE
);

-- Operational schedule
CREATE INDEX idx_vehicles_24_7 ON vehicles(property_id, operates_24_7, vehicle_status) WHERE is_deleted = FALSE AND operates_24_7 = TRUE;

-- JSONB indexes (GIN)
CREATE INDEX idx_vehicles_last_gps_gin ON vehicles USING GIN (last_gps_location) WHERE is_deleted = FALSE AND last_gps_location IS NOT NULL;
CREATE INDEX idx_vehicles_metadata_gin ON vehicles USING GIN (metadata) WHERE is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_vehicles_created ON vehicles(created_at);
CREATE INDEX idx_vehicles_updated ON vehicles(updated_at);

\echo 'Indexes for vehicles created successfully!'
