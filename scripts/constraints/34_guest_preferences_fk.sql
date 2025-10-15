-- =====================================================
-- 34_guest_preferences_fk.sql
-- Foreign Key Constraints for guest_preferences table
--
-- Relationships: tenant, property, guest, room_type, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_tenant;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_property;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_guest;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_room_type;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_created_by;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_updated_by;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_collected_by;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_verified_by;
ALTER TABLE guest_preferences DROP CONSTRAINT IF EXISTS fk_guest_preferences_deleted_by;

-- Tenant reference (required)
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_guest_preferences_tenant ON guest_preferences IS 'Guest preferences belong to a tenant';

-- Property reference (optional - may be guest-wide)
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_guest_preferences_property ON guest_preferences IS 'Preferences may be property-specific';

-- Guest reference (required)
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_guest
    FOREIGN KEY (guest_id)
    REFERENCES guests(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_guest_preferences_guest ON guest_preferences IS 'Preferences belong to guest';

-- Preferred room type reference (optional)
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_room_type
    FOREIGN KEY (preferred_room_type_id)
    REFERENCES room_types(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_guest_preferences_room_type ON guest_preferences IS 'Guest preferred room type';

-- Created by user
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Collected by user (staff who recorded preference)
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_collected_by
    FOREIGN KEY (collected_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_guest_preferences_collected_by ON guest_preferences IS 'Staff who recorded this preference';

-- Verified by user
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_verified_by
    FOREIGN KEY (verified_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_guest_preferences_verified_by ON guest_preferences IS 'Staff who verified this preference';

-- Deleted by user
ALTER TABLE guest_preferences
    ADD CONSTRAINT fk_guest_preferences_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: guest_preferences (34/37)'
\echo '  - 9 foreign key constraints'
\echo '  - Guest personalization complete'
\echo ''
