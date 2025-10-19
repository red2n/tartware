-- Foreign Key Constraints for mobile_keys table

ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_guest FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE CASCADE;
ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE;
ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE;
ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE mobile_keys ADD CONSTRAINT fk_mobile_keys_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id) ON DELETE SET NULL;
