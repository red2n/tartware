-- =====================================================
-- 05_rooms_fk.sql
-- Foreign Key Constraints for rooms
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for rooms...'

-- Foreign key to tenants table
ALTER TABLE rooms
ADD CONSTRAINT fk_rooms_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE rooms
ADD CONSTRAINT fk_rooms_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to room_types table
ALTER TABLE rooms
ADD CONSTRAINT fk_rooms_room_type_id
FOREIGN KEY (room_type_id)
REFERENCES room_types(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rooms_tenant_id ON rooms IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with rooms.';

COMMENT ON CONSTRAINT fk_rooms_property_id ON rooms IS
'Ensures property exists. RESTRICT prevents deleting properties with rooms.';

COMMENT ON CONSTRAINT fk_rooms_room_type_id ON rooms IS
'Ensures room type exists. RESTRICT prevents deleting room types with rooms.';

\echo '✓ Rooms foreign keys created successfully!'
