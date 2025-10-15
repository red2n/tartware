-- =====================================================
-- 32_booking_sources_fk.sql
-- Foreign Key Constraints for booking_sources table
--
-- Relationships: tenant, property, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE booking_sources DROP CONSTRAINT IF EXISTS fk_booking_sources_tenant;
ALTER TABLE booking_sources DROP CONSTRAINT IF EXISTS fk_booking_sources_property;
ALTER TABLE booking_sources DROP CONSTRAINT IF EXISTS fk_booking_sources_created_by;
ALTER TABLE booking_sources DROP CONSTRAINT IF EXISTS fk_booking_sources_updated_by;
ALTER TABLE booking_sources DROP CONSTRAINT IF EXISTS fk_booking_sources_deleted_by;

-- Tenant reference (required)
ALTER TABLE booking_sources
    ADD CONSTRAINT fk_booking_sources_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_booking_sources_tenant ON booking_sources IS 'Booking sources belong to a tenant';

-- Property reference (optional - may be tenant-wide)
ALTER TABLE booking_sources
    ADD CONSTRAINT fk_booking_sources_property
    FOREIGN KEY (property_id)
    REFERENCES properties(property_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_booking_sources_property ON booking_sources IS 'Booking sources may be property-specific';

-- Created by user
ALTER TABLE booking_sources
    ADD CONSTRAINT fk_booking_sources_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE booking_sources
    ADD CONSTRAINT fk_booking_sources_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Deleted by user
ALTER TABLE booking_sources
    ADD CONSTRAINT fk_booking_sources_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: booking_sources (32/37)'
\echo '  - 5 foreign key constraints'
\echo '  - Channel management relationships'
\echo ''
