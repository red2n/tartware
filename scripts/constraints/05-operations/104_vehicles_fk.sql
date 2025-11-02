-- =====================================================
-- Foreign Keys for vehicles table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for vehicles...'

-- Tenant reference
ALTER TABLE vehicles
    ADD CONSTRAINT fk_vehicles_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE vehicles
    ADD CONSTRAINT fk_vehicles_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Default driver reference
ALTER TABLE vehicles
    ADD CONSTRAINT fk_vehicles_default_driver
    FOREIGN KEY (default_driver_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Current driver reference
ALTER TABLE vehicles
    ADD CONSTRAINT fk_vehicles_current_driver
    FOREIGN KEY (current_driver_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

\echo 'Foreign keys for vehicles created successfully!'
