-- =====================================================
-- 13_settings_options.sql
-- Settings catalog options
-- =====================================================

\c tartware

\echo 'Creating settings_options table...'

CREATE TABLE IF NOT EXISTS settings_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_id UUID NOT NULL REFERENCES settings_definitions(id) ON DELETE CASCADE,
    value VARCHAR(128) NOT NULL,
    label VARCHAR(160) NOT NULL,
    description TEXT,
    icon VARCHAR(64),
    color VARCHAR(32),
    sort_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by VARCHAR(120),
    updated_by VARCHAR(120)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settings_options_setting_active_sort
    ON settings_options (setting_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_settings_options_setting_default
    ON settings_options (setting_id, is_default);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE settings_options IS 'Predefined options for SELECT/MULTISELECT/RADIO control types. Defines the allowed values for enumerated settings.';
COMMENT ON COLUMN settings_options.setting_id IS 'Parent setting definition this option belongs to';
COMMENT ON COLUMN settings_options.value IS 'Internal value stored when this option is selected';
COMMENT ON COLUMN settings_options.label IS 'Display label shown in UI';
COMMENT ON COLUMN settings_options.is_default IS 'TRUE if this is the default option for new values';
COMMENT ON COLUMN settings_options.sort_order IS 'Display order in dropdown/radio group';

\echo 'settings_options table created.'
