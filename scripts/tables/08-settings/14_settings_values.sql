-- =====================================================
-- 14_settings_values.sql
-- Settings catalog values
-- =====================================================

\c tartware

\echo 'Creating settings_values table...'

CREATE TABLE IF NOT EXISTS settings_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_id UUID NOT NULL REFERENCES settings_definitions(id) ON DELETE CASCADE,
    scope_level VARCHAR(64) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    value JSONB,
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    is_inherited BOOLEAN NOT NULL DEFAULT FALSE,
    inheritance_path UUID[],
    inherited_from_value_id UUID REFERENCES settings_values(id) ON DELETE SET NULL,
    locked_until TIMESTAMPTZ,
    effective_from DATE,
    effective_to DATE,
    source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    context JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by VARCHAR(120),
    updated_by VARCHAR(120)
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
