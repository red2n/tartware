-- =====================================================
-- 11_settings_sections.sql
-- Settings catalog sections
-- =====================================================

\c tartware

\echo 'Creating settings_sections table...'

CREATE TABLE IF NOT EXISTS settings_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL,
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

\echo 'settings_sections table created.'
