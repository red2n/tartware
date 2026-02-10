-- =====================================================
-- S11: Overbooking Config & Walk History
-- =====================================================
-- Purpose:
--   1. overbooking_config — per room-type overbooking allowances
--   2. walk_history — compensation tracking when guests are walked

\c tartware

-- ─── Overbooking Config ──────────────────────────────────────────────────────

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

-- ─── Walk History ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS walk_history (
    walk_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Original reservation
    reservation_id UUID NOT NULL,
    confirmation_number VARCHAR(50),
    guest_name VARCHAR(255) NOT NULL,
    guest_id UUID,

    -- Walk details
    walk_date DATE NOT NULL DEFAULT CURRENT_DATE,
    walk_reason TEXT,
    walked_by UUID,

    -- Alternate accommodation
    alternate_hotel_name VARCHAR(255),
    alternate_hotel_address TEXT,
    alternate_hotel_phone VARCHAR(50),
    alternate_confirmation VARCHAR(100),
    alternate_rate DECIMAL(15,2),
    alternate_nights INTEGER DEFAULT 1,

    -- Compensation
    compensation_type VARCHAR(50) CHECK (compensation_type IN (
        'first_night_covered', 'full_stay_covered', 'rate_discount',
        'loyalty_points', 'future_credit', 'cash', 'other'
    )),
    compensation_amount DECIMAL(15,2) DEFAULT 0.00,
    compensation_currency VARCHAR(3) DEFAULT 'USD',
    compensation_description TEXT,

    -- Transportation
    transportation_provided BOOLEAN DEFAULT FALSE,
    transportation_type VARCHAR(50),
    transportation_cost DECIMAL(10,2) DEFAULT 0.00,

    -- Return guarantee
    return_guaranteed BOOLEAN DEFAULT FALSE,
    return_date DATE,
    return_room_type VARCHAR(100),

    -- Totals
    total_walk_cost DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(alternate_rate * alternate_nights, 0) +
        COALESCE(compensation_amount, 0) +
        COALESCE(transportation_cost, 0)
    ) STORED,

    -- Status
    walk_status VARCHAR(50) DEFAULT 'initiated' CHECK (walk_status IN (
        'initiated', 'guest_contacted', 'alternate_secured',
        'guest_relocated', 'completed', 'cancelled'
    )),

    -- Communication
    guest_notified BOOLEAN DEFAULT FALSE,
    guest_notified_at TIMESTAMPTZ,
    guest_satisfaction VARCHAR(20) CHECK (guest_satisfaction IN (
        'satisfied', 'neutral', 'dissatisfied', 'complaint_filed'
    )),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE walk_history IS 'Tracks guest walk-outs due to overbooking with compensation details';
COMMENT ON COLUMN walk_history.total_walk_cost IS 'Total cost of the walk (alternate hotel + compensation + transport)';

-- Add index for walk reporting queries
CREATE INDEX IF NOT EXISTS idx_walk_history_property_date
    ON walk_history (tenant_id, property_id, walk_date);

CREATE INDEX IF NOT EXISTS idx_walk_history_reservation
    ON walk_history (reservation_id);

CREATE INDEX IF NOT EXISTS idx_overbooking_config_lookup
    ON overbooking_config (tenant_id, property_id, room_type_id)
    WHERE COALESCE(is_deleted, false) = false;

\echo 'S11: Overbooking config and walk history tables created successfully!'
