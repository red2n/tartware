-- =====================================================
-- Foreign Keys for shuttle_schedules table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for shuttle_schedules...'

-- Tenant reference
ALTER TABLE shuttle_schedules
    ADD CONSTRAINT fk_shuttle_schedules_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE shuttle_schedules
    ADD CONSTRAINT fk_shuttle_schedules_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Default vehicle reference
ALTER TABLE shuttle_schedules
    ADD CONSTRAINT fk_shuttle_schedules_default_vehicle
    FOREIGN KEY (default_vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE SET NULL;

-- Default driver reference
ALTER TABLE shuttle_schedules
    ADD CONSTRAINT fk_shuttle_schedules_default_driver
    FOREIGN KEY (default_driver_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

\echo 'Foreign keys for shuttle_schedules created successfully!'
