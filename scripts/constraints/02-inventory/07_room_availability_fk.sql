-- =====================================================
-- 07_room_availability_fk.sql
-- Foreign Key Constraints for availability.room_availability
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for availability.room_availability...'

-- Foreign key to tenants table
ALTER TABLE availability.room_availability
ADD CONSTRAINT fk_room_availability_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE availability.room_availability
ADD CONSTRAINT fk_room_availability_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to room_types table
ALTER TABLE availability.room_availability
ADD CONSTRAINT fk_room_availability_room_type_id
FOREIGN KEY (room_type_id)
REFERENCES room_types(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_room_availability_tenant_id ON availability.room_availability IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with availability records.';

COMMENT ON CONSTRAINT fk_room_availability_property_id ON availability.room_availability IS
'Ensures property exists. RESTRICT prevents deleting properties with availability records.';

COMMENT ON CONSTRAINT fk_room_availability_room_type_id ON availability.room_availability IS
'Ensures room type exists. RESTRICT prevents deleting room types with availability records.';

\echo '✓ Room_availability foreign keys created successfully!'
