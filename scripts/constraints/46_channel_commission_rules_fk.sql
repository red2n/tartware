-- Foreign key constraints for channel_commission_rules table

ALTER TABLE channel_commission_rules
    ADD CONSTRAINT fk_channel_commission_rules_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE channel_commission_rules
    ADD CONSTRAINT fk_channel_commission_rules_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE channel_commission_rules
    ADD CONSTRAINT fk_channel_commission_rules_ota_config
    FOREIGN KEY (ota_config_id) REFERENCES ota_configurations(config_id)
    ON DELETE SET NULL;

ALTER TABLE channel_commission_rules
    ADD CONSTRAINT fk_channel_commission_rules_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE channel_commission_rules
    ADD CONSTRAINT fk_channel_commission_rules_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE channel_commission_rules
    ADD CONSTRAINT fk_channel_commission_rules_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE channel_commission_rules
    ADD CONSTRAINT fk_channel_commission_rules_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
