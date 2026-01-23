-- =====================================================
-- user_settings.sql
-- User/persona level settings preferences
-- =====================================================

\c tartware \echo 'Creating user_settings table...'

CREATE TABLE IF NOT EXISTS user_settings (
    user_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- Unique identifier
    user_id UUID NOT NULL, -- FK to users
    setting_id UUID NOT NULL, -- FK to setting_definitions
    value JSONB NOT NULL, -- Stored as JSON to accommodate complex structures
    notes TEXT, -- User notes or rationale for change
    documentation TEXT, -- Snapshot of reference note at time of change
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    created_by UUID, -- Audit fields
    updated_by UUID, -- Audit fields
    UNIQUE (user_id, setting_id)
);

COMMENT ON TABLE user_settings IS 'Persona/role level preferences such as UI, notifications, accessibility.';

\echo '✓ user_settings created.'
