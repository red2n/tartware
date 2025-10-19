-- Foreign Key Constraints for marketing_campaigns table

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_manager
    FOREIGN KEY (campaign_manager_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE marketing_campaigns
    ADD CONSTRAINT fk_marketing_campaigns_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
