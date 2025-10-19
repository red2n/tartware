-- =====================================================
-- 06_room_types_indexes.sql
-- Indexes for room_types table
-- Performance optimization for room type queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for room_types table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_room_types_tenant_id ON room_types(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_types_property_id ON room_types(property_id) WHERE deleted_at IS NULL;

-- Composite index for property room types (most common query)
CREATE INDEX IF NOT EXISTS idx_room_types_property_active ON room_types(property_id, is_active, deleted_at) WHERE deleted_at IS NULL;

-- Type code and name lookups
CREATE INDEX IF NOT EXISTS idx_room_types_code ON room_types(type_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_types_name ON room_types(type_name) WHERE deleted_at IS NULL;

-- Category filter
CREATE INDEX IF NOT EXISTS idx_room_types_category ON room_types(category) WHERE deleted_at IS NULL;

-- Occupancy search
CREATE INDEX IF NOT EXISTS idx_room_types_max_occupancy ON room_types(max_occupancy) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_types_base_occupancy ON room_types(base_occupancy) WHERE deleted_at IS NULL;

-- Pricing
CREATE INDEX IF NOT EXISTS idx_room_types_base_price ON room_types(base_price) WHERE deleted_at IS NULL;

-- Status filter
CREATE INDEX IF NOT EXISTS idx_room_types_is_active ON room_types(is_active) WHERE deleted_at IS NULL;

-- Display order (for sorting)
CREATE INDEX IF NOT EXISTS idx_room_types_display_order ON room_types(display_order) WHERE deleted_at IS NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_room_types_amenities_gin ON room_types USING GIN(amenities);
CREATE INDEX IF NOT EXISTS idx_room_types_features_gin ON room_types USING GIN(features);
CREATE INDEX IF NOT EXISTS idx_room_types_images_gin ON room_types USING GIN(images);

-- Composite for property + category
CREATE INDEX IF NOT EXISTS idx_room_types_property_category ON room_types(property_id, category, deleted_at) WHERE deleted_at IS NULL AND is_active = true;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_room_types_created_at ON room_types(created_at);
CREATE INDEX IF NOT EXISTS idx_room_types_updated_at ON room_types(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_room_types_deleted_at ON room_types(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Room_types indexes created successfully!'
