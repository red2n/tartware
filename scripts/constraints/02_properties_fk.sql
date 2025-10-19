-- =====================================================
-- 02_properties_fk.sql
-- Foreign Key Constraints for properties
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for properties...'

-- Foreign key to tenants table
ALTER TABLE properties
ADD CONSTRAINT fk_properties_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_properties_tenant_id ON properties IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with properties (use soft delete instead).';

\echo '✓ Properties foreign keys created successfully!'
