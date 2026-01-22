-- =====================================================
-- 14_settings_values.sql
-- Settings catalog values
-- =====================================================

\c tartware

\echo 'Creating settings_values table...'

CREATE TABLE IF NOT EXISTS settings_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_id UUID NOT NULL,
    scope_level VARCHAR(64) NOT NULL,
    tenant_id UUID NOT NULL,
    property_id UUID,
    unit_id UUID,
    user_id UUID,
    value JSONB,
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    is_inherited BOOLEAN NOT NULL DEFAULT FALSE,
    inheritance_path UUID[],
    inherited_from_value_id UUID,
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

\echo 'settings_values table created.'
