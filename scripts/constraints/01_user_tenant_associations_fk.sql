-- =====================================================
-- 01_user_tenant_associations_fk.sql
-- Foreign Key Constraints for user_tenant_associations
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for user_tenant_associations...'

-- Foreign key to users table
ALTER TABLE user_tenant_associations
ADD CONSTRAINT fk_user_tenant_assoc_user_id
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to tenants table
ALTER TABLE user_tenant_associations
ADD CONSTRAINT fk_user_tenant_assoc_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_user_tenant_assoc_user_id ON user_tenant_associations IS
'Ensures user exists before association. RESTRICT prevents deleting users with active associations.';

COMMENT ON CONSTRAINT fk_user_tenant_assoc_tenant_id ON user_tenant_associations IS
'Ensures tenant exists before association. RESTRICT prevents deleting tenants with active users.';

\echo '✓ User_tenant_associations foreign keys created successfully!'
