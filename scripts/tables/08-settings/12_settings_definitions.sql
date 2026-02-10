-- =====================================================
-- 12_settings_definitions.sql
-- Settings catalog definitions
-- =====================================================

\c tartware

\echo 'Creating settings_definitions table...'

CREATE TABLE IF NOT EXISTS settings_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),               -- Unique definition identifier
    category_id UUID NOT NULL REFERENCES settings_categories(id) ON DELETE CASCADE, -- Parent category
    section_id UUID NOT NULL REFERENCES settings_sections(id) ON DELETE CASCADE,    -- Parent section
    code VARCHAR(96) NOT NULL UNIQUE,                             -- Dot-notation setting key
    name VARCHAR(160) NOT NULL,                                   -- Display name
    description TEXT NOT NULL,                                    -- Detailed setting description
    help_text TEXT,                                               -- Extended help for users
    placeholder VARCHAR(256),                                     -- Input placeholder text
    tooltip VARCHAR(512),                                         -- Hover tooltip text
    data_type VARCHAR(64) NOT NULL,                               -- Value type (STRING, INTEGER, etc.)
    control_type VARCHAR(64) NOT NULL,                            -- UI control (TEXT, SELECT, etc.)
    default_value JSONB,                                          -- Default value for new instances
    value_constraints JSONB,                                      -- Validation rules (min, max, pattern)
    allowed_scopes TEXT[] NOT NULL,                                -- Configurable scopes (SYSTEM, TENANT, etc.)
    default_scope VARCHAR(64) NOT NULL,                           -- Default scope for new values
    override_scopes TEXT[],                                       -- Scopes that can override parents
    is_required BOOLEAN NOT NULL DEFAULT FALSE,                   -- Whether a value is mandatory
    is_advanced BOOLEAN NOT NULL DEFAULT FALSE,                   -- Hidden under advanced toggle
    is_readonly BOOLEAN NOT NULL DEFAULT FALSE,                   -- Prevents user modification
    is_deprecated BOOLEAN NOT NULL DEFAULT FALSE,                 -- Marked for removal
    sensitivity VARCHAR(64) NOT NULL DEFAULT 'INTERNAL',          -- Data sensitivity level
    module_dependencies TEXT[],                                   -- Required modules for this setting
    feature_flag VARCHAR(120),                                    -- Feature flag gating this setting
    compliance_tags TEXT[],                                       -- Compliance labels (PCI, GDPR, etc.)
    related_settings UUID[],                                      -- Links to related definitions
    labels JSONB,                                                 -- UI labels and translations
    tags TEXT[],                                                  -- Searchable tags
    sort_order INT NOT NULL DEFAULT 0,                            -- Display order within section
    version VARCHAR(64),                                          -- Schema version of definition
    reference_docs TEXT[],                                        -- Links to related documentation
    form_schema JSONB,                                            -- JSON Schema for complex values
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Extensible key-value metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                -- Row creation timestamp
    updated_at TIMESTAMPTZ,                                       -- Last modification timestamp
    created_by VARCHAR(120),                                      -- User who created this record
    updated_by VARCHAR(120)                                       -- User who last modified this record
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
