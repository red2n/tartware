-- =====================================================
-- 12_settings_definitions.sql
-- Settings catalog definitions
-- =====================================================

\c tartware

\echo 'Creating settings_definitions table...'

CREATE TABLE IF NOT EXISTS settings_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES settings_categories(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES settings_sections(id) ON DELETE CASCADE,
    code VARCHAR(96) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    help_text TEXT,
    placeholder VARCHAR(256),
    tooltip VARCHAR(512),
    data_type VARCHAR(64) NOT NULL,
    control_type VARCHAR(64) NOT NULL,
    default_value JSONB,
    value_constraints JSONB,
    allowed_scopes TEXT[] NOT NULL,
    default_scope VARCHAR(64) NOT NULL,
    override_scopes TEXT[],
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_advanced BOOLEAN NOT NULL DEFAULT FALSE,
    is_readonly BOOLEAN NOT NULL DEFAULT FALSE,
    is_deprecated BOOLEAN NOT NULL DEFAULT FALSE,
    sensitivity VARCHAR(64) NOT NULL DEFAULT 'INTERNAL',
    module_dependencies TEXT[],
    feature_flag VARCHAR(120),
    compliance_tags TEXT[],
    related_settings UUID[],
    labels JSONB,
    tags TEXT[],
    sort_order INT NOT NULL DEFAULT 0,
    version VARCHAR(64),
    reference_docs TEXT[],
    form_schema JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by VARCHAR(120),
    updated_by VARCHAR(120)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settings_definitions_section_sort
    ON settings_definitions (section_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_settings_definitions_deprecated
    ON settings_definitions (is_deprecated);

CREATE INDEX IF NOT EXISTS idx_settings_definitions_feature_flag
    ON settings_definitions (feature_flag);

\echo 'settings_definitions table created.'
