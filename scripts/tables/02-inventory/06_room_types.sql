-- =====================================================
-- room_types.sql
-- Room Types Table
-- Industry Standard: Room categories/classifications
-- Pattern: Oracle OPERA Cloud Room Type, Cloudbeds Room Type
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating room_types table...'

-- =====================================================
-- ROOM_TYPES TABLE
-- Room categories (e.g., Deluxe, Suite, Standard)
-- Master data for room classification
-- =====================================================

CREATE TABLE IF NOT EXISTS room_types (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique identifier for room category

-- Multi-Tenancy & Hierarchy
tenant_id UUID NOT NULL, -- FK tenants.id for isolation
property_id UUID NOT NULL, -- FK properties.id tying type to a property

-- Basic Information
type_name VARCHAR(255) NOT NULL, -- Human-readable category label
type_code VARCHAR(50) NOT NULL, -- Short code used in rate plans/integrations

-- Description
description TEXT, -- Long-form marketing copy
short_description VARCHAR(500), -- Summary used in cards/lists

-- Room Category
category room_category NOT NULL DEFAULT 'STANDARD', -- ENUM grouping for reporting

-- Capacity
base_occupancy INTEGER NOT NULL DEFAULT 2, -- Default number of guests included
max_occupancy INTEGER NOT NULL DEFAULT 2, -- Maximum allowed occupants
max_adults INTEGER NOT NULL DEFAULT 2, -- Adult limit for regulatory compliance
max_children INTEGER DEFAULT 0, -- Child limit for packaging logic
extra_bed_capacity INTEGER DEFAULT 0, -- Number of additional rollaways permitted

-- Room Details
size_sqm DECIMAL(10, 2), -- Floor area in square meters
bed_type VARCHAR(100), -- Bed configuration (King, Twin)
number_of_beds INTEGER DEFAULT 1, -- Count of physical beds

-- Amenities (JSONB array)
amenities JSONB DEFAULT '[]'::jsonb, -- List of amenity identifiers (JSON array)

-- Features
features JSONB DEFAULT '{
        "view": null,
        "floor": null,
        "accessibility": false,
        "connecting": false,
        "smoking": false
    }'::jsonb, -- Structured attributes (view, accessibility)

-- Pricing
base_price DECIMAL(15, 2) NOT NULL, -- Rack/base price used for default rates
currency VARCHAR(3) DEFAULT 'USD', -- ISO currency code for pricing

-- Media
images JSONB DEFAULT '[]'::jsonb, -- Ordered list of image URLs

-- Display Order
display_order INTEGER DEFAULT 0, -- Sorting weight for UIs

-- Status
is_active BOOLEAN NOT NULL DEFAULT true, -- Allows disabling a type without deleting

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Extensibility for integrations

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP, -- Last modification timestamp
created_by VARCHAR(100), -- Creator user identifier
updated_by VARCHAR(100), -- Modifier user identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Deletion timestamp
deleted_by VARCHAR(100), -- Deleting user identifier

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Concurrency control version counter

-- Constraints
CONSTRAINT room_types_code_unique UNIQUE (property_id, type_code), -- Prevent duplicate codes per property
    CONSTRAINT room_types_code_format CHECK (type_code ~ '^[A-Z0-9_-]+$'), -- Enforce code format
    CONSTRAINT room_types_occupancy_check CHECK (base_occupancy <= max_occupancy), -- Base cannot exceed max
    CONSTRAINT room_types_max_adults_check CHECK (max_adults > 0), -- Require at least one adult
    CONSTRAINT room_types_max_children_check CHECK (max_children >= 0), -- Disallow negative child count
    CONSTRAINT room_types_size_check CHECK (size_sqm IS NULL OR size_sqm > 0), -- Positive room size if provided
    CONSTRAINT room_types_base_price_check CHECK (base_price >= 0) -- Price must be non-negative
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
