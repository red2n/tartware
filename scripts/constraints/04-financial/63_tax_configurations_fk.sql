-- Foreign Key Constraints for tax_configurations table

-- Multi-Tenancy
ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

-- Composite Tax Relationship
ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_composite
    FOREIGN KEY (composite_tax_id) REFERENCES tax_configurations(tax_config_id)
    ON DELETE SET NULL;

-- Historical Tracking
ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_replaced_by
    FOREIGN KEY (replaced_by_config_id) REFERENCES tax_configurations(tax_config_id)
    ON DELETE SET NULL;

ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_replaces
    FOREIGN KEY (replaces_config_id) REFERENCES tax_configurations(tax_config_id)
    ON DELETE SET NULL;

-- Approval
ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Audit Fields
ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Soft Delete
ALTER TABLE tax_configurations
    ADD CONSTRAINT fk_tax_configs_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
