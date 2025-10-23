-- =====================================================
-- 13_services_fk.sql
-- Foreign Key Constraints for services
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for services...'

-- Foreign key to tenants table
ALTER TABLE services
ADD CONSTRAINT fk_services_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE services
ADD CONSTRAINT fk_services_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_services_tenant_id ON services IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with services.';

COMMENT ON CONSTRAINT fk_services_property_id ON services IS
'Ensures property exists. RESTRICT prevents deleting properties with services.';

\echo '✓ Services foreign keys created successfully!'
