-- =====================================================
-- 11_settings_sections.sql
-- Settings catalog sections
-- =====================================================

\c tartware

\echo 'Creating settings_sections table...'

CREATE TABLE IF NOT EXISTS settings_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES settings_categories(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    icon VARCHAR(64),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
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
