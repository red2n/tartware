-- =====================================================
-- 06_settings_indexes.sql
-- Indexes for settings catalog and override tables
-- Date: 2025-11-12
-- =====================================================

\c tartware

\echo 'Creating indexes for settings tables...'

-- Lookup indexes for catalog tables
CREATE INDEX IF NOT EXISTS idx_setting_definitions_category
    ON setting_definitions (category_id);

CREATE INDEX IF NOT EXISTS idx_setting_definitions_key_active
    ON setting_definitions (setting_key)
    WHERE is_active = TRUE;

-- Tenant / property / room / user override lookups
CREATE INDEX IF NOT EXISTS idx_tenant_settings_lookup
    ON tenant_settings (tenant_id, setting_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_setting
    ON tenant_settings (setting_id);

CREATE INDEX IF NOT EXISTS idx_property_settings_lookup
    ON property_settings (property_id, setting_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_property_settings_setting
    ON property_settings (setting_id);

CREATE INDEX IF NOT EXISTS idx_room_settings_lookup
    ON room_settings (room_id, setting_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_room_settings_setting
    ON room_settings (setting_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_lookup
    ON user_settings (user_id, setting_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_setting
    ON user_settings (setting_id);

-- Activity timestamps
CREATE INDEX IF NOT EXISTS idx_tenant_settings_updated_at
    ON tenant_settings (updated_at);

CREATE INDEX IF NOT EXISTS idx_property_settings_updated_at
    ON property_settings (updated_at);

CREATE INDEX IF NOT EXISTS idx_room_settings_updated_at
    ON room_settings (updated_at);

CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at
    ON user_settings (updated_at);

\echo '✓ Settings indexes created successfully!'
