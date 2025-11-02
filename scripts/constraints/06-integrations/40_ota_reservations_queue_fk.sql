-- Foreign key constraints for ota_reservations_queue table

-- Foreign key to tenants
ALTER TABLE ota_reservations_queue
    ADD CONSTRAINT fk_ota_queue_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Foreign key to properties
ALTER TABLE ota_reservations_queue
    ADD CONSTRAINT fk_ota_queue_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Foreign key to ota_configurations
ALTER TABLE ota_reservations_queue
    ADD CONSTRAINT fk_ota_queue_ota_config
    FOREIGN KEY (ota_configuration_id) REFERENCES ota_configurations(id) ON DELETE CASCADE;

-- Foreign key to reservations (set NULL if reservation is deleted)
ALTER TABLE ota_reservations_queue
    ADD CONSTRAINT fk_ota_queue_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;
