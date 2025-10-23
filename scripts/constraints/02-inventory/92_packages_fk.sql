-- =============================================
-- Foreign Key Constraints for 92_packages
-- =============================================

ALTER TABLE packages ADD CONSTRAINT fk_packages_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE packages ADD CONSTRAINT fk_packages_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE packages ADD CONSTRAINT fk_packages_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE packages ADD CONSTRAINT fk_packages_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE packages ADD CONSTRAINT fk_packages_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
ALTER TABLE package_components ADD CONSTRAINT fk_package_components_package_id FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE;
ALTER TABLE package_components ADD CONSTRAINT fk_package_components_service_id FOREIGN KEY (service_id) REFERENCES services(id);
ALTER TABLE package_components ADD CONSTRAINT fk_package_components_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE package_components ADD CONSTRAINT fk_package_components_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE package_bookings ADD CONSTRAINT fk_package_bookings_package_id FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE RESTRICT;
ALTER TABLE package_bookings ADD CONSTRAINT fk_package_bookings_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE package_bookings ADD CONSTRAINT fk_package_bookings_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE package_bookings ADD CONSTRAINT fk_package_bookings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
