-- =====================================================
-- setting_definitions.sql
-- Canonical setting definitions
-- =====================================================

\c tartware \echo 'Creating setting_definitions table...'

CREATE TABLE IF NOT EXISTS setting_definitions (
    setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- Unique identifier
    category_id UUID NOT NULL, -- FK to setting_categories
    setting_key VARCHAR(150) NOT NULL, -- e.g., rbac.role_matrix
    setting_name VARCHAR(255) NOT NULL, -- Human-readable label
    description TEXT NOT NULL, -- Summary for quick reference
    storage_level VARCHAR(20) NOT NULL CHECK (
        storage_level IN (
            'GLOBAL',
            'TENANT',
            'PROPERTY',
            'ROOM',
            'USER'
        )
    ),
    data_type VARCHAR(25) NOT NULL CHECK (
        data_type IN (
            'BOOLEAN',
            'INTEGER',
            'DECIMAL',
            'STRING',
            'ENUM',
            'JSON',
            'ARRAY'
        )
    ),
    default_value JSONB, -- Optional JSON template/default
    allowed_values JSONB, -- Definition of permissible values (arrays, ranges, enums)
    documentation TEXT, -- Extended explanation, business rules, compliance notes
    is_required BOOLEAN NOT NULL DEFAULT FALSE, -- Indicates if the setting is mandatory
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- Soft delete flag for deprecating settings
    tags TEXT [] DEFAULT '{}', -- Array of tags for filtering and categorization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    created_by UUID, -- Audit fields
    updated_by UUID, -- Audit fields
    UNIQUE (setting_key)
);

COMMENT ON TABLE setting_definitions IS 'Canonical setting catalogue with storage level, data type, and rich documentation.';

COMMENT ON COLUMN setting_definitions.documentation IS 'Markdown copied from TODO.md rows for UI rendering and audits.';

COMMENT ON COLUMN setting_definitions.allowed_values IS 'JSON schema fragment or enumerated values that constrain valid inputs.';

\echo '✓ setting_definitions created.'
