-- Foreign key constraints for pricing_rules table

ALTER TABLE pricing_rules
    ADD CONSTRAINT fk_pricing_rules_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE pricing_rules
    ADD CONSTRAINT fk_pricing_rules_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE pricing_rules
    ADD CONSTRAINT fk_pricing_rules_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE pricing_rules
    ADD CONSTRAINT fk_pricing_rules_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE pricing_rules
    ADD CONSTRAINT fk_pricing_rules_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE pricing_rules
    ADD CONSTRAINT fk_pricing_rules_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
