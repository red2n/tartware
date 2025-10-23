-- Foreign Key Constraints for push_notifications table

ALTER TABLE push_notifications ADD CONSTRAINT fk_push_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
ALTER TABLE push_notifications ADD CONSTRAINT fk_push_notifications_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
ALTER TABLE push_notifications ADD CONSTRAINT fk_push_notifications_guest FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE CASCADE;
ALTER TABLE push_notifications ADD CONSTRAINT fk_push_notifications_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE push_notifications ADD CONSTRAINT fk_push_notifications_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE push_notifications ADD CONSTRAINT fk_push_notifications_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id) ON DELETE SET NULL;
