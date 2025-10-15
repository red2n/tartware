-- =====================================================
-- 07_rooms_indexes.sql
-- Indexes for rooms table
-- Performance optimization for room inventory queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for rooms table...'

-- Foreign key indexes (critical for joins)
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id ON rooms(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_property_id ON rooms(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_room_type_id ON rooms(room_type_id) WHERE deleted_at IS NULL;

-- Room number lookup (unique within property)
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_property_number ON rooms(property_id, room_number) WHERE deleted_at IS NULL;

-- Status indexes (critical for availability)
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_housekeeping_status ON rooms(housekeeping_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_maintenance_status ON rooms(maintenance_status) WHERE deleted_at IS NULL;

-- Composite status index (most common query: available clean rooms)
CREATE INDEX IF NOT EXISTS idx_rooms_availability ON rooms(property_id, room_type_id, status, housekeeping_status, deleted_at)
    WHERE deleted_at IS NULL AND is_blocked = false AND is_out_of_order = false;

-- Blocking status
CREATE INDEX IF NOT EXISTS idx_rooms_is_blocked ON rooms(is_blocked) WHERE is_blocked = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_blocked_dates ON rooms(blocked_from, blocked_until) WHERE is_blocked = true AND deleted_at IS NULL;

-- Out of order status
CREATE INDEX IF NOT EXISTS idx_rooms_is_out_of_order ON rooms(is_out_of_order) WHERE is_out_of_order = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_out_of_order_since ON rooms(out_of_order_since) WHERE is_out_of_order = true AND deleted_at IS NULL;

-- Location filters
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_wing ON rooms(wing) WHERE deleted_at IS NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_rooms_features_gin ON rooms USING GIN(features);
CREATE INDEX IF NOT EXISTS idx_rooms_amenities_gin ON rooms USING GIN(amenities);

-- Composite for property + type + status
CREATE INDEX IF NOT EXISTS idx_rooms_property_type_status ON rooms(property_id, room_type_id, status) WHERE deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_rooms_deleted_at ON rooms(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Rooms indexes created successfully!'
