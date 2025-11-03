-- =====================================================
-- Foreign keys for gds_connections table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for gds_connections...'

-- Tenant scope
ALTER TABLE gds_connections
    ADD CONSTRAINT fk_gds_connections_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope (optional - chain level connections allowed)
ALTER TABLE gds_connections
    ADD CONSTRAINT fk_gds_connections_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE gds_connections
    ADD CONSTRAINT fk_gds_connections_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE gds_connections
    ADD CONSTRAINT fk_gds_connections_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE gds_connections
    ADD CONSTRAINT fk_gds_connections_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for gds_connections created successfully!'
