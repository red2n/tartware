-- =====================================================
-- room_types.sql
-- Room Types Table
-- Industry Standard: Room categories/classifications
-- Pattern: Oracle OPERA Cloud Room Type, Cloudbeds Room Type
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating room_types table...'

-- =====================================================
-- ROOM_TYPES TABLE
-- Room categories (e.g., Deluxe, Suite, Standard)
-- Master data for room classification
-- =====================================================

CREATE TABLE IF NOT EXISTS room_types (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Basic Information
    type_name VARCHAR(255) NOT NULL,
    type_code VARCHAR(50) NOT NULL,

    -- Description
    description TEXT,
    short_description VARCHAR(500),

    -- Room Category
    category room_category NOT NULL DEFAULT 'standard',

    -- Capacity
    base_occupancy INTEGER NOT NULL DEFAULT 2,
    max_occupancy INTEGER NOT NULL DEFAULT 2,
    max_adults INTEGER NOT NULL DEFAULT 2,
    max_children INTEGER DEFAULT 0,
    extra_bed_capacity INTEGER DEFAULT 0,

    -- Room Details
    size_sqm DECIMAL(10,2),
    bed_type VARCHAR(100),
    number_of_beds INTEGER DEFAULT 1,

    -- Amenities (JSONB array)
    amenities JSONB DEFAULT '[]'::jsonb,

    -- Features
    features JSONB DEFAULT '{
        "view": null,
        "floor": null,
        "accessibility": false,
        "connecting": false,
        "smoking": false
    }'::jsonb,

    -- Pricing
    base_price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Media
    images JSONB DEFAULT '[]'::jsonb,

    -- Display Order
    display_order INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT room_types_code_unique UNIQUE (property_id, type_code),
    CONSTRAINT room_types_code_format CHECK (type_code ~ '^[A-Z0-9_-]+$'),
    CONSTRAINT room_types_occupancy_check CHECK (base_occupancy <= max_occupancy),
    CONSTRAINT room_types_max_adults_check CHECK (max_adults > 0),
    CONSTRAINT room_types_max_children_check CHECK (max_children >= 0),
    CONSTRAINT room_types_size_check CHECK (size_sqm IS NULL OR size_sqm > 0),
    CONSTRAINT room_types_base_price_check CHECK (base_price >= 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE room_types IS 'Room type categories (e.g., Deluxe, Suite, Standard)';
COMMENT ON COLUMN room_types.id IS 'Unique room type identifier (UUID)';
COMMENT ON COLUMN room_types.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN room_types.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN room_types.type_name IS 'Display name (e.g., Deluxe King Suite)';
COMMENT ON COLUMN room_types.type_code IS 'Unique code within property (e.g., DLX-K)';
COMMENT ON COLUMN room_types.category IS 'ENUM: standard, deluxe, suite, premium, economy';
COMMENT ON COLUMN room_types.base_occupancy IS 'Standard occupancy (default guests)';
COMMENT ON COLUMN room_types.max_occupancy IS 'Maximum total occupancy';
COMMENT ON COLUMN room_types.max_adults IS 'Maximum adults allowed';
COMMENT ON COLUMN room_types.max_children IS 'Maximum children allowed';
COMMENT ON COLUMN room_types.extra_bed_capacity IS 'Number of extra beds available';
COMMENT ON COLUMN room_types.size_sqm IS 'Room size in square meters';
COMMENT ON COLUMN room_types.amenities IS 'List of amenities (JSONB array)';
COMMENT ON COLUMN room_types.features IS 'Room features (view, floor, accessibility, etc.)';
COMMENT ON COLUMN room_types.base_price IS 'Base/rack rate price';
COMMENT ON COLUMN room_types.images IS 'Array of image URLs (JSONB)';
COMMENT ON COLUMN room_types.display_order IS 'Sort order for display';
COMMENT ON COLUMN room_types.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Room_types table created successfully!'
