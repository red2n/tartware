-- =====================================================
-- 03_guests_fk.sql
-- Foreign Key Constraints for guests
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for guests...'

-- Foreign key to tenants table
ALTER TABLE guests
ADD CONSTRAINT fk_guests_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_guests_tenant_id ON guests IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with guest records (use soft delete instead).';

\echo '✓ Guests foreign keys created successfully!'
