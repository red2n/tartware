-- =============================================
-- Indexes for 99_smart_room_devices
-- =============================================

CREATE INDEX idx_smart_room_devices_tenant ON smart_room_devices(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_smart_room_devices_property ON smart_room_devices(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_smart_room_devices_room ON smart_room_devices(room_id);
CREATE INDEX idx_smart_room_devices_type ON smart_room_devices(device_type);
CREATE INDEX idx_smart_room_devices_status ON smart_room_devices(status, operational_status);
CREATE INDEX idx_smart_room_devices_online ON smart_room_devices(is_online);
CREATE INDEX idx_smart_room_devices_serial ON smart_room_devices(serial_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_room_energy_usage_room ON room_energy_usage(room_id);
CREATE INDEX idx_room_energy_usage_date ON room_energy_usage(measurement_date DESC);
CREATE INDEX idx_room_energy_usage_occupied ON room_energy_usage(is_occupied, measurement_date);
CREATE INDEX idx_room_energy_usage_alert ON room_energy_usage(over_consumption_alert) WHERE over_consumption_alert = TRUE;
CREATE INDEX idx_guest_room_preferences_guest ON guest_room_preferences(guest_id);
CREATE INDEX idx_guest_room_preferences_property ON guest_room_preferences(property_id);
CREATE INDEX idx_device_events_log_device ON device_events_log(device_id);
CREATE INDEX idx_device_events_log_type ON device_events_log(event_type);
CREATE INDEX idx_device_events_log_timestamp ON device_events_log(event_timestamp DESC);
CREATE INDEX idx_device_events_log_severity ON device_events_log(severity) WHERE severity IN ('error', 'critical');
CREATE INDEX idx_device_events_log_unresolved ON device_events_log(resolved) WHERE resolved = FALSE;
