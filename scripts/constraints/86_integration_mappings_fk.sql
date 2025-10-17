-- Foreign Key Constraints for integration_mappings table

ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE integration_mappings ADD CONSTRAINT fk_integration_mappings_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id) ON DELETE SET NULL;
