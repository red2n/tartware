-- =====================================================
-- 06_rates_fk.sql
-- Foreign Key Constraints for rates
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for rates...'

-- Foreign key to tenants table
ALTER TABLE rates
ADD CONSTRAINT fk_rates_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE rates
ADD CONSTRAINT fk_rates_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to room_types table
ALTER TABLE rates
ADD CONSTRAINT fk_rates_room_type_id
FOREIGN KEY (room_type_id)
REFERENCES room_types(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rates_tenant_id ON rates IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with rates.';

COMMENT ON CONSTRAINT fk_rates_property_id ON rates IS
'Ensures property exists. RESTRICT prevents deleting properties with rates.';

COMMENT ON CONSTRAINT fk_rates_room_type_id ON rates IS
'Ensures room type exists. RESTRICT prevents deleting room types with rates.';

\echo '✓ Rates foreign keys created successfully!'
