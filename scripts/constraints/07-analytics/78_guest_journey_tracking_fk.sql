-- Foreign Key Constraints for guest_journey_tracking table

ALTER TABLE guest_journey_tracking ADD CONSTRAINT fk_guest_journey_tracking_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE guest_journey_tracking ADD CONSTRAINT fk_guest_journey_tracking_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE guest_journey_tracking ADD CONSTRAINT fk_guest_journey_tracking_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE guest_journey_tracking ADD CONSTRAINT fk_guest_journey_tracking_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE guest_journey_tracking ADD CONSTRAINT fk_guest_journey_tracking_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE guest_journey_tracking ADD CONSTRAINT fk_guest_journey_tracking_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
