-- =====================================================
-- Foreign keys for gds_message_log table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for gds_message_log...'

-- Parent connection
ALTER TABLE gds_message_log
    ADD CONSTRAINT fk_gds_message_log_connection
    FOREIGN KEY (gds_connection_id) REFERENCES gds_connections(gds_connection_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Tenant scope
ALTER TABLE gds_message_log
    ADD CONSTRAINT fk_gds_message_log_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE gds_message_log
    ADD CONSTRAINT fk_gds_message_log_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE gds_message_log
    ADD CONSTRAINT fk_gds_message_log_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE gds_message_log
    ADD CONSTRAINT fk_gds_message_log_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for gds_message_log created successfully!'
