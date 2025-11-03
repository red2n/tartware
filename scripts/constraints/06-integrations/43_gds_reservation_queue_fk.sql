-- =====================================================
-- Foreign keys for gds_reservation_queue table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for gds_reservation_queue...'

-- Message association
ALTER TABLE gds_reservation_queue
    ADD CONSTRAINT fk_gds_reservation_queue_message
    FOREIGN KEY (gds_message_id) REFERENCES gds_message_log(gds_message_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Connection association
ALTER TABLE gds_reservation_queue
    ADD CONSTRAINT fk_gds_reservation_queue_connection
    FOREIGN KEY (gds_connection_id) REFERENCES gds_connections(gds_connection_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Tenant scope
ALTER TABLE gds_reservation_queue
    ADD CONSTRAINT fk_gds_reservation_queue_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE gds_reservation_queue
    ADD CONSTRAINT fk_gds_reservation_queue_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Linked reservation after processing
ALTER TABLE gds_reservation_queue
    ADD CONSTRAINT fk_gds_reservation_queue_processed_reservation
    FOREIGN KEY (processed_reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE gds_reservation_queue
    ADD CONSTRAINT fk_gds_reservation_queue_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE gds_reservation_queue
    ADD CONSTRAINT fk_gds_reservation_queue_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for gds_reservation_queue created successfully!'
