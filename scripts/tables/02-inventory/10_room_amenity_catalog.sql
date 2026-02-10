-- =====================================================
-- room_amenity_catalog.sql
-- Canonical amenity catalog per property
-- Guarantees consistent amenity codes for room templates
-- Date: 2025-12-25
-- =====================================================

\c tartware
\echo 'Creating room_amenity_catalog table...'

CREATE TABLE IF NOT EXISTS room_amenity_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique amenity record identifier
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- Owning tenant for multi-chain scope
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE, -- Property that defines this amenity
    amenity_code VARCHAR(80) NOT NULL, -- Stable code used in APIs and templates
    display_name VARCHAR(160) NOT NULL, -- Human-readable amenity label
    description TEXT, -- Optional detailed amenity description
    category VARCHAR(80) DEFAULT 'GENERAL', -- Grouping (TECHNOLOGY, WELLNESS, etc.)
    icon VARCHAR(120), -- Icon identifier for UI rendering
    tags TEXT[] DEFAULT '{}'::text[], -- Freeform classification tags
    sort_order INTEGER DEFAULT 0, -- Display ordering weight
    is_default BOOLEAN DEFAULT TRUE, -- Shipped by Tartware out-of-box
    is_active BOOLEAN DEFAULT TRUE, -- Soft-delete / visibility flag
    is_required BOOLEAN DEFAULT FALSE, -- Mandatory in room templates
    metadata JSONB DEFAULT '{}'::jsonb, -- Extensible custom attributes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Row creation timestamp
    updated_at TIMESTAMPTZ, -- Last modification timestamp
    created_by UUID, -- User who created the record
    updated_by UUID, -- User who last modified the record
    CONSTRAINT room_amenity_catalog_unique_code UNIQUE (property_id, amenity_code),
    CONSTRAINT room_amenity_catalog_code_format CHECK (amenity_code ~ '^[A-Z0-9_\\-]+$')
);

COMMENT ON TABLE room_amenity_catalog IS 'Canonical amenity catalog per property. Source of truth for room amenity codes.';
COMMENT ON COLUMN room_amenity_catalog.tenant_id IS 'Tenant scope for multi-property chains.';
COMMENT ON COLUMN room_amenity_catalog.property_id IS 'Property that owns this amenity definition.';
COMMENT ON COLUMN room_amenity_catalog.amenity_code IS 'Stable amenity identifier used in APIs and room templates.';
COMMENT ON COLUMN room_amenity_catalog.display_name IS 'Human readable amenity label.';
COMMENT ON COLUMN room_amenity_catalog.category IS 'Amenity grouping (e.g., TECHNOLOGY, WELLNESS).';
COMMENT ON COLUMN room_amenity_catalog.is_default IS 'TRUE when Tartware ships this amenity by default.';
COMMENT ON COLUMN room_amenity_catalog.is_required IS 'If TRUE, cloned room templates must include this amenity.';

CREATE INDEX IF NOT EXISTS idx_room_amenity_catalog_property
    ON room_amenity_catalog (property_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_room_amenity_catalog_tenant
    ON room_amenity_catalog (tenant_id);

CREATE INDEX IF NOT EXISTS idx_room_amenity_catalog_active
    ON room_amenity_catalog (property_id)
    WHERE is_active = TRUE;

\echo 'room_amenity_catalog table created.'
