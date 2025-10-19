-- =====================================================
-- 08_reservations_fk.sql
-- Foreign Key Constraints for reservations
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for reservations...'

-- Foreign key to tenants table
ALTER TABLE reservations
ADD CONSTRAINT fk_reservations_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE reservations
ADD CONSTRAINT fk_reservations_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to guests table
ALTER TABLE reservations
ADD CONSTRAINT fk_reservations_guest_id
FOREIGN KEY (guest_id)
REFERENCES guests(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to room_types table
ALTER TABLE reservations
ADD CONSTRAINT fk_reservations_room_type_id
FOREIGN KEY (room_type_id)
REFERENCES room_types(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to rates table (nullable)
ALTER TABLE reservations
ADD CONSTRAINT fk_reservations_rate_id
FOREIGN KEY (rate_id)
REFERENCES rates(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_reservations_tenant_id ON reservations IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with reservations.';

COMMENT ON CONSTRAINT fk_reservations_property_id ON reservations IS
'Ensures property exists. RESTRICT prevents deleting properties with reservations.';

COMMENT ON CONSTRAINT fk_reservations_guest_id ON reservations IS
'Ensures guest exists. RESTRICT prevents deleting guests with reservations (cascade soft delete instead).';

COMMENT ON CONSTRAINT fk_reservations_room_type_id ON reservations IS
'Ensures room type exists. RESTRICT prevents deleting room types with reservations.';

COMMENT ON CONSTRAINT fk_reservations_rate_id ON reservations IS
'Ensures rate exists if specified. RESTRICT prevents deleting rates with reservations.';

\echo '✓ Reservations foreign keys created successfully!'
