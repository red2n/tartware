-- =====================================================
-- 13_settings_options.sql
-- Settings catalog options
-- =====================================================

\c tartware

\echo 'Creating settings_options table...'

CREATE TABLE IF NOT EXISTS settings_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),               -- Unique option identifier
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- Owning tenant
    setting_id UUID NOT NULL REFERENCES settings_definitions(id) ON DELETE CASCADE, -- Parent setting definition
    value VARCHAR(128) NOT NULL,                                  -- Stored value when selected
    label VARCHAR(160) NOT NULL,                                  -- Display label in UI
    description TEXT,                                             -- Optional option description
    icon VARCHAR(64),                                             -- Icon identifier for UI display
    color VARCHAR(32),                                            -- UI display color
    sort_order INT NOT NULL DEFAULT 0,                            -- Display order in list
    is_default BOOLEAN NOT NULL DEFAULT FALSE,                    -- Default option for new values
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                      -- Soft-delete / visibility flag
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Extensible key-value metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                -- Row creation timestamp
    updated_at TIMESTAMPTZ,                                       -- Last modification timestamp
    created_by VARCHAR(120),                                      -- User who created this record
    updated_by VARCHAR(120)                                       -- User who last modified this record
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_options_setting_value
    ON settings_options (setting_id, value);

CREATE INDEX IF NOT EXISTS idx_settings_options_setting_active_sort
    ON settings_options (setting_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_settings_options_setting_default
    ON settings_options (setting_id, is_default);

-- Unique constraint via index (supports ON CONFLICT)
ALTER TABLE settings_options
    DROP CONSTRAINT IF EXISTS uq_options_setting_value;
ALTER TABLE settings_options
    ADD CONSTRAINT uq_options_setting_value UNIQUE USING INDEX uq_settings_options_setting_value;

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE settings_options IS 'Predefined options for SELECT/MULTISELECT/RADIO control types. Defines the allowed values for enumerated settings.';

-- Add tenant_id to existing installations before referencing it in COMMENT ON COLUMN
ALTER TABLE settings_options ADD COLUMN IF NOT EXISTS
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill NULL tenant_id with the system tenant for existing rows
UPDATE settings_options
   SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
 WHERE tenant_id IS NULL;

-- Enforce NOT NULL after backfill (idempotent — no-op if already NOT NULL)
ALTER TABLE settings_options ALTER COLUMN tenant_id SET NOT NULL;

-- Backfill NULL tenant_id with the system tenant for existing rows
UPDATE settings_options
   SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
 WHERE tenant_id IS NULL;

-- Enforce NOT NULL after backfill (idempotent — no-op if already NOT NULL)
ALTER TABLE settings_options ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN settings_options.tenant_id IS 'Owning tenant — all catalog rows are tenant-scoped';
COMMENT ON COLUMN settings_options.setting_id IS 'Parent setting definition this option belongs to';
COMMENT ON COLUMN settings_options.value IS 'Internal value stored when this option is selected';
COMMENT ON COLUMN settings_options.label IS 'Display label shown in UI';
COMMENT ON COLUMN settings_options.is_default IS 'TRUE if this is the default option for new values';
COMMENT ON COLUMN settings_options.sort_order IS 'Display order in dropdown/radio group';

\echo 'settings_options table created.'
