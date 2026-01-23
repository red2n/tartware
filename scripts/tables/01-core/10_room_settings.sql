-- =====================================================
-- room_settings.sql
-- Room/unit level settings overrides
-- =====================================================

\c tartware \echo 'Creating room_settings table...'

CREATE TABLE IF NOT EXISTS room_settings (
    room_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- Unique identifier
    room_id UUID NOT NULL, -- FK to rooms/units
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
        room_id,
        setting_id,
        effective_from
    )
);

COMMENT ON TABLE room_settings IS 'Unit/room specific settings (e.g., amenities, automation, sustainability toggles).';

\echo '✓ room_settings created.'
