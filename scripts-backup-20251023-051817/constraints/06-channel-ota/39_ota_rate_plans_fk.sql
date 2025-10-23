-- Foreign key constraints for ota_rate_plans table

-- Foreign key to tenants
ALTER TABLE ota_rate_plans
    ADD CONSTRAINT IF NOT EXISTS fk_ota_rate_plan_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Foreign key to properties
ALTER TABLE ota_rate_plans
    ADD CONSTRAINT IF NOT EXISTS fk_ota_rate_plan_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Foreign key to ota_configurations
ALTER TABLE ota_rate_plans
    ADD CONSTRAINT IF NOT EXISTS fk_ota_rate_plan_ota_config
    FOREIGN KEY (ota_configuration_id) REFERENCES ota_configurations(id) ON DELETE CASCADE;

-- Foreign key to rates
ALTER TABLE ota_rate_plans
    ADD CONSTRAINT IF NOT EXISTS fk_ota_rate_plan_rate
    FOREIGN KEY (rate_id) REFERENCES rates(id) ON DELETE CASCADE;

-- Foreign key to users (created_by)
ALTER TABLE ota_rate_plans
    ADD CONSTRAINT IF NOT EXISTS fk_ota_rate_plan_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Foreign key to users (updated_by)
ALTER TABLE ota_rate_plans
    ADD CONSTRAINT IF NOT EXISTS fk_ota_rate_plan_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
