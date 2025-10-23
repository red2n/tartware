-- =============================================
-- Foreign Key Constraints for 101_asset_inventory
-- =============================================

ALTER TABLE asset_inventory ADD CONSTRAINT fk_asset_inventory_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE asset_inventory ADD CONSTRAINT fk_asset_inventory_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE asset_inventory ADD CONSTRAINT fk_asset_inventory_room_id FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE asset_inventory ADD CONSTRAINT fk_asset_inventory_smart_device_id FOREIGN KEY (smart_device_id) REFERENCES smart_room_devices(device_id);
ALTER TABLE asset_inventory ADD CONSTRAINT fk_asset_inventory_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE asset_inventory ADD CONSTRAINT fk_asset_inventory_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE asset_inventory ADD CONSTRAINT fk_asset_inventory_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
ALTER TABLE predictive_maintenance_alerts ADD CONSTRAINT fk_predictive_maintenance_alerts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE predictive_maintenance_alerts ADD CONSTRAINT fk_predictive_maintenance_alerts_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE predictive_maintenance_alerts ADD CONSTRAINT fk_predictive_maintenance_alerts_asset_id FOREIGN KEY (asset_id) REFERENCES asset_inventory(asset_id) ON DELETE CASCADE;
ALTER TABLE predictive_maintenance_alerts ADD CONSTRAINT fk_predictive_maintenance_alerts_acknowledged_by FOREIGN KEY (acknowledged_by) REFERENCES users(id);
ALTER TABLE predictive_maintenance_alerts ADD CONSTRAINT fk_predictive_maintenance_alerts_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id);
ALTER TABLE maintenance_history ADD CONSTRAINT fk_maintenance_history_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE maintenance_history ADD CONSTRAINT fk_maintenance_history_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE maintenance_history ADD CONSTRAINT fk_maintenance_history_asset_id FOREIGN KEY (asset_id) REFERENCES asset_inventory(asset_id) ON DELETE CASCADE;
ALTER TABLE maintenance_history ADD CONSTRAINT fk_maintenance_history_technician_id FOREIGN KEY (technician_id) REFERENCES users(id);
ALTER TABLE maintenance_history ADD CONSTRAINT fk_maintenance_history_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE maintenance_history ADD CONSTRAINT fk_maintenance_history_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
