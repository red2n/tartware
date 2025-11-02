-- Foreign key constraints for ota_configurations table
-- These are already defined in the table creation script, but listed here for reference

-- Foreign key to tenants
ALTER TABLE ota_configurations
    ADD CONSTRAINT fk_ota_config_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Foreign key to properties
ALTER TABLE ota_configurations
    ADD CONSTRAINT fk_ota_config_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Foreign key to users (created_by)
ALTER TABLE ota_configurations
    ADD CONSTRAINT fk_ota_config_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Foreign key to users (updated_by)
ALTER TABLE ota_configurations
    ADD CONSTRAINT fk_ota_config_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
