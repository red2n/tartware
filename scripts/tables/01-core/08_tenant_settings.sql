-- =====================================================
-- tenant_settings.sql
-- Tenant-level settings values
-- =====================================================

\c tartware \echo 'Creating tenant_settings table...'

CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- Unique identifier
    tenant_id UUID NOT NULL, -- FK to tenants
    setting_id UUID NOT NULL, -- FK to setting_definitions
    value JSONB NOT NULL, -- Stored as JSON to accommodate complex structures
    effective_from DATE DEFAULT CURRENT_DATE, -- Date from which this setting is valid
    effective_to DATE, -- Optional end date for validity
    notes TEXT, -- Admin notes or rationale for change
    documentation TEXT, -- Snapshot of reference note at time of change
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    created_by UUID, -- Audit fields
    updated_by UUID, -- Audit fields
    UNIQUE (
        tenant_id,
        setting_id,
        effective_from
    )
);

COMMENT ON TABLE tenant_settings IS 'Tenant-wide configuration values derived from setting_definitions.';

COMMENT ON COLUMN tenant_settings.documentation IS 'Optional copy of documentation to preserve context when auditing historical changes.';

\echo '✓ tenant_settings created.'
