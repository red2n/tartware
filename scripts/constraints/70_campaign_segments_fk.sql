-- Foreign Key Constraints for campaign_segments table

ALTER TABLE campaign_segments
    ADD CONSTRAINT fk_campaign_segments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE campaign_segments
    ADD CONSTRAINT fk_campaign_segments_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE campaign_segments
    ADD CONSTRAINT fk_campaign_segments_owner
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE campaign_segments
    ADD CONSTRAINT fk_campaign_segments_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE campaign_segments
    ADD CONSTRAINT fk_campaign_segments_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE campaign_segments
    ADD CONSTRAINT fk_campaign_segments_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
