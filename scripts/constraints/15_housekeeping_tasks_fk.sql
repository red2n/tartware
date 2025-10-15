-- =====================================================
-- 15_housekeeping_tasks_fk.sql
-- Foreign Key Constraints for housekeeping_tasks
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for housekeeping_tasks...'

-- Foreign key to tenants table
ALTER TABLE housekeeping_tasks
ADD CONSTRAINT fk_housekeeping_tasks_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE housekeeping_tasks
ADD CONSTRAINT fk_housekeeping_tasks_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Note: room_number is a VARCHAR field, not a foreign key to rooms table
-- The housekeeping_tasks table uses room_number (string) instead of room_id (uuid)

COMMENT ON CONSTRAINT fk_housekeeping_tasks_tenant_id ON housekeeping_tasks IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with housekeeping tasks.';

COMMENT ON CONSTRAINT fk_housekeeping_tasks_property_id ON housekeeping_tasks IS
'Ensures property exists. RESTRICT prevents deleting properties with housekeeping tasks.';

\echo '✓ Housekeeping_tasks foreign keys created successfully!'
