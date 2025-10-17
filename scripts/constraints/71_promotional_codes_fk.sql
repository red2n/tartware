-- Foreign Key Constraints for promotional_codes table

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_campaign
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(campaign_id)
    ON DELETE SET NULL;

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_owner
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE promotional_codes
    ADD CONSTRAINT fk_promotional_codes_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
