-- =====================================================
-- Foreign keys for spa_treatments table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for spa_treatments...'

-- Tenant scope
ALTER TABLE spa_treatments
    ADD CONSTRAINT fk_spa_treatments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE spa_treatments
    ADD CONSTRAINT fk_spa_treatments_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Default treatment room
ALTER TABLE spa_treatments
    ADD CONSTRAINT fk_spa_treatments_default_room
    FOREIGN KEY (default_room_id) REFERENCES rooms(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE spa_treatments
    ADD CONSTRAINT fk_spa_treatments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE spa_treatments
    ADD CONSTRAINT fk_spa_treatments_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE spa_treatments
    ADD CONSTRAINT fk_spa_treatments_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for spa_treatments created successfully!'
