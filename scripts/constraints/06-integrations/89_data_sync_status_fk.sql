-- Foreign Key Constraints for data_sync_status table

ALTER TABLE data_sync_status ADD CONSTRAINT fk_data_sync_status_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE data_sync_status ADD CONSTRAINT fk_data_sync_status_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE data_sync_status ADD CONSTRAINT fk_data_sync_status_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE data_sync_status ADD CONSTRAINT fk_data_sync_status_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE data_sync_status ADD CONSTRAINT fk_data_sync_status_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
