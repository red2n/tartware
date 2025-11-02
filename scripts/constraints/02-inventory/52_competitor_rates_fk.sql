-- Foreign key constraints for competitor_rates table

ALTER TABLE competitor_rates
    ADD CONSTRAINT fk_competitor_rates_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE competitor_rates
    ADD CONSTRAINT fk_competitor_rates_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE competitor_rates
    ADD CONSTRAINT fk_competitor_rates_our_room_type
    FOREIGN KEY (our_property_room_type_id) REFERENCES room_types(id)
    ON DELETE SET NULL;

ALTER TABLE competitor_rates
    ADD CONSTRAINT fk_competitor_rates_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE competitor_rates
    ADD CONSTRAINT fk_competitor_rates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE competitor_rates
    ADD CONSTRAINT fk_competitor_rates_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE competitor_rates
    ADD CONSTRAINT fk_competitor_rates_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
