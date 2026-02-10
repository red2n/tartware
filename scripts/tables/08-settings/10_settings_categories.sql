-- =====================================================
-- 10_settings_categories.sql
-- Settings catalog categories
-- =====================================================

\c tartware

\echo 'Creating settings_categories table...'

CREATE TABLE IF NOT EXISTS settings_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),               -- Unique category identifier
    code VARCHAR(64) NOT NULL UNIQUE,                             -- Machine-readable category key
    name VARCHAR(120) NOT NULL,                                   -- Display name
    description TEXT,                                             -- Optional category description
    icon VARCHAR(64),                                             -- Icon identifier for UI display
    color VARCHAR(32),                                            -- UI display color
    sort_order INT NOT NULL DEFAULT 0,                            -- Display order in settings UI
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                      -- Soft-delete / visibility flag
    tags TEXT[] DEFAULT '{}',                                     -- Searchable tags for filtering
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Extensible key-value metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                -- Row creation timestamp
    updated_at TIMESTAMPTZ                                        -- Last modification timestamp
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settings_categories_active_sort
    ON settings_categories (is_active, sort_order);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE settings_categories IS 'Top-level grouping for system settings. Categories organize sections and definitions into logical UI groups (e.g., Reservations, Billing, Operations).';
COMMENT ON COLUMN settings_categories.code IS 'Unique identifier code for programmatic access (e.g., RESERVATIONS, BILLING)';
COMMENT ON COLUMN settings_categories.sort_order IS 'Display order in settings UI navigation';
COMMENT ON COLUMN settings_categories.tags IS 'Searchable tags for filtering categories';
COMMENT ON COLUMN settings_categories.icon IS 'Icon identifier for UI display (e.g., FontAwesome class)';

\echo 'settings_categories table created.'
