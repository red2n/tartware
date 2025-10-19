-- =====================================================
-- 16_channel_mappings_fk.sql
-- Foreign Key Constraints for channel_mappings
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for channel_mappings...'

-- Foreign key to tenants table
ALTER TABLE channel_mappings
ADD CONSTRAINT fk_channel_mappings_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE channel_mappings
ADD CONSTRAINT fk_channel_mappings_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Note: entity_id is a polymorphic foreign key (can reference rooms, room_types, rates, etc.)
-- based on entity_type column. Cannot add a single foreign key constraint for polymorphic relationships.

COMMENT ON CONSTRAINT fk_channel_mappings_tenant_id ON channel_mappings IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with channel mappings.';

COMMENT ON CONSTRAINT fk_channel_mappings_property_id ON channel_mappings IS
'Ensures property exists. RESTRICT prevents deleting properties with channel mappings.';

\echo '✓ Channel_mappings foreign keys created successfully!'
