-- =====================================================
-- 101_room_amenity_catalog.sql
-- Canonical amenity catalog per property/tenant
-- Mirrors hospitality PMS master-data approach (Opera, Cloudbeds)
-- Date: 2025-12-15
-- =====================================================

\c tartware \echo 'Creating room_amenity_catalog table...'

CREATE TABLE IF NOT EXISTS room_amenity_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique amenity identifier
    tenant_id UUID NOT NULL, -- FK tenants.id for isolation
    property_id UUID NOT NULL, -- FK properties.id to scope amenities
    amenity_code VARCHAR(100) NOT NULL, -- Short code (e.g., WIFI, SMART_TV)
    amenity_name VARCHAR(255) NOT NULL, -- Display name
    category VARCHAR(100) NOT NULL, -- Grouping (CONNECTIVITY, COMFORT, etc.)
    description TEXT, -- Operator-facing description
    icon VARCHAR(100), -- Optional UI icon hint
    is_default BOOLEAN NOT NULL DEFAULT FALSE, -- True when seeded by platform
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- Soft-enable flag for tenant overrides
    rank INTEGER NOT NULL DEFAULT 0, -- Ordering for UI picklists
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Extensibility (tags, localization)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID, -- Optional audit linkage
    updated_by UUID, -- Optional audit linkage
    CONSTRAINT room_amenity_catalog_code_unique UNIQUE (property_id, amenity_code),
    CONSTRAINT room_amenity_catalog_code_format CHECK (amenity_code ~ '^[A-Z0-9_-]+$'),
    CONSTRAINT room_amenity_catalog_rank_positive CHECK (rank >= 0),
    CONSTRAINT fk_room_amenity_catalog_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants (id) ON DELETE CASCADE,
    CONSTRAINT fk_room_amenity_catalog_property FOREIGN KEY (property_id)
        REFERENCES properties (id) ON DELETE CASCADE
);

COMMENT ON TABLE room_amenity_catalog IS 'Per-property amenity catalog used to seed room type amenity sets.';
COMMENT ON COLUMN room_amenity_catalog.amenity_code IS 'Stable identifier (e.g., WIFI, SMART_TV) referenced by room_types.amenities.';
COMMENT ON COLUMN room_amenity_catalog.is_default IS 'TRUE when provisioned by Tartware setup scripts (safe to regenerate).';
COMMENT ON COLUMN room_amenity_catalog.is_active IS 'Soft toggle so tenants can disable defaults without deleting.';
COMMENT ON COLUMN room_amenity_catalog.rank IS 'Ordering weight for amenity picklists/templates.';

CREATE INDEX IF NOT EXISTS idx_room_amenity_catalog_tenant ON room_amenity_catalog (tenant_id);
CREATE INDEX IF NOT EXISTS idx_room_amenity_catalog_property ON room_amenity_catalog (property_id);
CREATE INDEX IF NOT EXISTS idx_room_amenity_catalog_is_default ON room_amenity_catalog (property_id, is_default);

\echo 'room_amenity_catalog table created successfully!'
