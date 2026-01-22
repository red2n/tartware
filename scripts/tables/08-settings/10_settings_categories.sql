-- =====================================================
-- 10_settings_categories.sql
-- Settings catalog categories
-- =====================================================

\c tartware

\echo 'Creating settings_categories table...'

CREATE TABLE IF NOT EXISTS settings_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    icon VARCHAR(64),
    color VARCHAR(32),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

\echo 'settings_categories table created.'
