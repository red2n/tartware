-- Foreign key constraints for ota_inventory_sync table

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_ota_config
    FOREIGN KEY (ota_config_id) REFERENCES ota_configurations(id)
    ON DELETE CASCADE;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_room_type
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    ON DELETE SET NULL;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_rate_plan
    FOREIGN KEY (rate_plan_id) REFERENCES rates(id)
    ON DELETE SET NULL;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_triggered_by_user
    FOREIGN KEY (triggered_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE ota_inventory_sync
    ADD CONSTRAINT fk_ota_inventory_sync_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
