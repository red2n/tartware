-- Foreign Key Constraints for qr_codes table

ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
