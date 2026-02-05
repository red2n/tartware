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

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE settings_definitions IS 'Master catalog of all configurable settings. Defines data type, validation rules, scopes, and UI rendering for each setting.';
COMMENT ON COLUMN settings_definitions.code IS 'Unique dot-notation setting key (e.g., reservations.check_in.default_time)';
COMMENT ON COLUMN settings_definitions.data_type IS 'Data type: STRING, INTEGER, DECIMAL, BOOLEAN, DATE, TIME, DATETIME, JSON, ARRAY';
COMMENT ON COLUMN settings_definitions.control_type IS 'UI control: TEXT, TEXTAREA, SELECT, MULTISELECT, CHECKBOX, RADIO, DATE_PICKER, TIME_PICKER, SLIDER, COLOR_PICKER';
COMMENT ON COLUMN settings_definitions.value_constraints IS 'Validation rules: min, max, pattern, enum values, custom validators';
COMMENT ON COLUMN settings_definitions.allowed_scopes IS 'Scopes where this setting can be configured: SYSTEM, TENANT, PROPERTY, UNIT, USER';
COMMENT ON COLUMN settings_definitions.default_scope IS 'Default scope when creating new values';
COMMENT ON COLUMN settings_definitions.override_scopes IS 'Scopes that can override parent scope values';
COMMENT ON COLUMN settings_definitions.sensitivity IS 'Data sensitivity: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED';
COMMENT ON COLUMN settings_definitions.module_dependencies IS 'Modules required to use this setting';
COMMENT ON COLUMN settings_definitions.feature_flag IS 'Feature flag that must be enabled for this setting';
COMMENT ON COLUMN settings_definitions.compliance_tags IS 'Compliance/audit tags: PCI, GDPR, SOC2, HIPAA';
COMMENT ON COLUMN settings_definitions.form_schema IS 'JSON Schema for complex/nested setting values';

\echo 'settings_definitions table created.'
