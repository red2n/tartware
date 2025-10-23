-- =============================================
-- Foreign Key Constraints for 99_smart_room_devices
-- =============================================

ALTER TABLE smart_room_devices ADD CONSTRAINT fk_smart_room_devices_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE smart_room_devices ADD CONSTRAINT fk_smart_room_devices_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE smart_room_devices ADD CONSTRAINT fk_smart_room_devices_room_id FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE smart_room_devices ADD CONSTRAINT fk_smart_room_devices_installed_by FOREIGN KEY (installed_by) REFERENCES users(id);
ALTER TABLE smart_room_devices ADD CONSTRAINT fk_smart_room_devices_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE smart_room_devices ADD CONSTRAINT fk_smart_room_devices_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE smart_room_devices ADD CONSTRAINT fk_smart_room_devices_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
ALTER TABLE room_energy_usage ADD CONSTRAINT fk_room_energy_usage_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE room_energy_usage ADD CONSTRAINT fk_room_energy_usage_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE room_energy_usage ADD CONSTRAINT fk_room_energy_usage_room_id FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE room_energy_usage ADD CONSTRAINT fk_room_energy_usage_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id);
ALTER TABLE room_energy_usage ADD CONSTRAINT fk_room_energy_usage_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id);
ALTER TABLE guest_room_preferences ADD CONSTRAINT fk_guest_room_preferences_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE guest_room_preferences ADD CONSTRAINT fk_guest_room_preferences_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE guest_room_preferences ADD CONSTRAINT fk_guest_room_preferences_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE device_events_log ADD CONSTRAINT fk_device_events_log_device_id FOREIGN KEY (device_id) REFERENCES smart_room_devices(device_id) ON DELETE CASCADE;
ALTER TABLE device_events_log ADD CONSTRAINT fk_device_events_log_triggered_by_user_id FOREIGN KEY (triggered_by_user_id) REFERENCES users(id);
ALTER TABLE device_events_log ADD CONSTRAINT fk_device_events_log_triggered_by_guest_id FOREIGN KEY (triggered_by_guest_id) REFERENCES guests(id);
