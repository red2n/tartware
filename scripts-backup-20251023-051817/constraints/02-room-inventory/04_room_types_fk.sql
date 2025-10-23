-- =====================================================
-- 04_room_types_fk.sql
-- Foreign Key Constraints for room_types
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for room_types...'

-- Foreign key to tenants table
ALTER TABLE room_types
ADD CONSTRAINT fk_room_types_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE room_types
ADD CONSTRAINT fk_room_types_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_room_types_tenant_id ON room_types IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with room types.';

COMMENT ON CONSTRAINT fk_room_types_property_id ON room_types IS
'Ensures property exists. RESTRICT prevents deleting properties with room types (cascade soft delete instead).';

\echo '✓ Room_types foreign keys created successfully!'
