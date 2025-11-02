-- Foreign key constraints for channel_rate_parity table

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_room_type
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    ON DELETE CASCADE;

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_rate_plan
    FOREIGN KEY (rate_plan_id) REFERENCES rates(id)
    ON DELETE SET NULL;

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE channel_rate_parity
    ADD CONSTRAINT fk_channel_rate_parity_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
