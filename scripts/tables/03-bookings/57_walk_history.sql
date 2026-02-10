-- =====================================================
-- S11: Walk History
-- Records of guests walked due to overbooking
-- =====================================================

CREATE TABLE IF NOT EXISTS walk_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    guest_id UUID,

    -- Walk details
    walk_date DATE NOT NULL,
    walk_reason TEXT DEFAULT 'overbooking',
    destination_hotel TEXT,
    destination_confirmation TEXT,

    -- Compensation
    compensation_type TEXT DEFAULT 'one_night'
        CHECK (compensation_type IN ('one_night', 'flat_fee', 'percentage', 'custom')),
    compensation_amount DECIMAL(12,2) DEFAULT 0,
    transport_provided BOOLEAN DEFAULT TRUE,
    transport_cost DECIMAL(12,2) DEFAULT 0,
    total_walk_cost DECIMAL(12,2) GENERATED ALWAYS AS (
        COALESCE(compensation_amount, 0) + COALESCE(transport_cost, 0)
    ) STORED,

    -- Status tracking
    walk_status TEXT DEFAULT 'pending'
        CHECK (walk_status IN ('pending', 'confirmed', 'guest_notified', 'completed', 'cancelled')),
    guest_notified_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_walk_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE RESTRICT
);

COMMENT ON TABLE walk_history IS 'History of guests walked due to overbooking';
COMMENT ON COLUMN walk_history.total_walk_cost IS 'Auto-calculated: compensation + transport cost';
COMMENT ON COLUMN walk_history.walk_status IS 'Walk process status: pending → confirmed → guest_notified → completed';

CREATE INDEX IF NOT EXISTS idx_walk_history_property_date
    ON walk_history (tenant_id, property_id, walk_date);

CREATE INDEX IF NOT EXISTS idx_walk_history_reservation
    ON walk_history (reservation_id);
