-- =====================================================
-- S11: Overbooking Configuration
-- Per room-type overbooking policy settings
-- =====================================================

CREATE TABLE IF NOT EXISTS overbooking_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    room_type_id UUID NOT NULL,

    -- Overbooking policy
    allow_overbooking BOOLEAN NOT NULL DEFAULT TRUE,
    max_overbook_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00
        CHECK (max_overbook_percent >= 0 AND max_overbook_percent <= 100),
    max_overbook_rooms INTEGER
        CHECK (max_overbook_rooms IS NULL OR max_overbook_rooms >= 0),
    auto_release_hours_before_arrival INTEGER DEFAULT 24,

    -- Priority rules for walk candidates
    walk_priority_order TEXT DEFAULT 'low_rate,no_loyalty,short_stay',

    -- Notifications
    alert_threshold_percent DECIMAL(5,2) DEFAULT 90.00,
    notify_revenue_manager BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_overbooking_config UNIQUE (tenant_id, property_id, room_type_id)
);

COMMENT ON TABLE overbooking_config IS 'Per room-type overbooking policy configuration';
COMMENT ON COLUMN overbooking_config.max_overbook_percent IS 'Maximum percentage of rooms that can be oversold';
COMMENT ON COLUMN overbooking_config.walk_priority_order IS 'Comma-separated priority for choosing walk candidates';

CREATE INDEX IF NOT EXISTS idx_overbooking_config_lookup
    ON overbooking_config (tenant_id, property_id, room_type_id)
    WHERE COALESCE(is_deleted, false) = false;

\echo 'overbooking_config table created successfully!'
