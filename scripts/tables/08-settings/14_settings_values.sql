-- =====================================================
-- 14_settings_values.sql
-- Settings catalog values
-- =====================================================

\c tartware

\echo 'Creating settings_values table...'

CREATE TABLE IF NOT EXISTS settings_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),               -- Unique value identifier
    setting_id UUID NOT NULL REFERENCES settings_definitions(id) ON DELETE CASCADE, -- Parent setting definition
    scope_level VARCHAR(64) NOT NULL,                             -- Scope: SYSTEM, TENANT, PROPERTY, etc.
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- Owning tenant
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE, -- Optional property scope
    unit_id UUID REFERENCES rooms(id) ON DELETE CASCADE,          -- Optional room/unit scope
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,          -- Optional user scope
    value JSONB,                                                  -- Setting value as JSONB
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,                 -- Overrides a parent scope value
    is_inherited BOOLEAN NOT NULL DEFAULT FALSE,                  -- Inherited from parent scope
    inheritance_path UUID[],                                      -- Parent value IDs in chain
    inherited_from_value_id UUID REFERENCES settings_values(id) ON DELETE SET NULL, -- Source inherited value
    locked_until TIMESTAMPTZ,                                     -- Change lock expiry timestamp
    effective_from DATE,                                          -- Start date for time-bound value
    effective_to DATE,                                            -- End date for time-bound value
    source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',                 -- How value was set (MANUAL, API, etc.)
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',                 -- Value status (ACTIVE, ARCHIVED, etc.)
    notes TEXT,                                                   -- Free-text notes or remarks
    context JSONB,                                                -- Additional context metadata
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Extensible key-value metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                -- Row creation timestamp
    updated_at TIMESTAMPTZ,                                       -- Last modification timestamp
    created_by VARCHAR(120),                                      -- User who created this record
    updated_by VARCHAR(120)                                       -- User who last modified this record
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settings_values_tenant_scope_status
    ON settings_values (tenant_id, scope_level, status);

CREATE INDEX IF NOT EXISTS idx_settings_values_setting_tenant
    ON settings_values (setting_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_settings_values_property_setting
    ON settings_values (property_id, setting_id);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE settings_values IS 'Actual configured values for settings at each scope level. Supports inheritance and override patterns across tenant/property/unit/user hierarchy.';
COMMENT ON COLUMN settings_values.scope_level IS 'Scope of this value: SYSTEM, TENANT, PROPERTY, UNIT, USER';
COMMENT ON COLUMN settings_values.value IS 'The setting value as JSONB (supports all data types)';
COMMENT ON COLUMN settings_values.is_overridden IS 'TRUE if this value overrides a parent scope value';
COMMENT ON COLUMN settings_values.is_inherited IS 'TRUE if this value is inherited from a parent scope';
COMMENT ON COLUMN settings_values.inheritance_path IS 'Array of parent value IDs showing inheritance chain';
COMMENT ON COLUMN settings_values.locked_until IS 'Prevents changes until this timestamp (for approval workflows)';
COMMENT ON COLUMN settings_values.effective_from IS 'Start date for time-bound settings (e.g., seasonal rates)';
COMMENT ON COLUMN settings_values.effective_to IS 'End date for time-bound settings';
COMMENT ON COLUMN settings_values.source IS 'How this value was set: MANUAL, IMPORT, API, MIGRATION, DEFAULT';
COMMENT ON COLUMN settings_values.status IS 'Value status: ACTIVE, PENDING_APPROVAL, REJECTED, ARCHIVED';

\echo 'settings_values table created.'
