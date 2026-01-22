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

\echo 'settings_values table created.'
