-- =====================================================
-- 11_settings_sections.sql
-- Settings catalog sections
-- =====================================================

\c tartware

\echo 'Creating settings_sections table...'

CREATE TABLE IF NOT EXISTS settings_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),               -- Unique section identifier
    category_id UUID NOT NULL REFERENCES settings_categories(id) ON DELETE CASCADE, -- Parent category
    code VARCHAR(64) NOT NULL,                                    -- Machine-readable section key
    name VARCHAR(160) NOT NULL,                                   -- Display name
    description TEXT,                                             -- Optional section description
    icon VARCHAR(64),                                             -- Icon identifier for UI display
    sort_order INT NOT NULL DEFAULT 0,                            -- Display order within category
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                      -- Soft-delete / visibility flag
    tags TEXT[] DEFAULT '{}',                                     -- Searchable tags for filtering
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Extensible key-value metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                -- Row creation timestamp
    updated_at TIMESTAMPTZ                                        -- Last modification timestamp
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settings_sections_category_active_sort
    ON settings_sections (category_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_settings_sections_code
    ON settings_sections (code);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE settings_sections IS 'Logical grouping within a settings category. Sections organize related settings definitions (e.g., Check-in Rules, Rate Policies).';
COMMENT ON COLUMN settings_sections.category_id IS 'Parent category this section belongs to';
COMMENT ON COLUMN settings_sections.code IS 'Unique identifier within category for programmatic access';
COMMENT ON COLUMN settings_sections.sort_order IS 'Display order within the parent category';

\echo 'settings_sections table created.'
