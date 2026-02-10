-- =============================================
-- Price Adjustments History
-- =============================================

CREATE TABLE IF NOT EXISTS price_adjustments_history (
    -- Primary Key
    adjustment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- What was adjusted
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    rate_code VARCHAR(50),
    target_date DATE NOT NULL,

    -- Price Change
    previous_rate DECIMAL(10,2) NOT NULL,
    new_rate DECIMAL(10,2) NOT NULL,
    adjustment_amount DECIMAL(10,2) GENERATED ALWAYS AS (new_rate - previous_rate) STORED,
    adjustment_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN previous_rate > 0 THEN ((new_rate - previous_rate) / previous_rate) * 100
            ELSE NULL
        END
    ) STORED,

    -- Why was it adjusted
    adjustment_trigger VARCHAR(50) CHECK (adjustment_trigger IN (
        'ml_model',
        'occupancy_threshold',
        'competitor_price',
        'booking_pace',
        'event_detected',
        'manual_override',
        'time_based',
        'demand_surge',
        'last_minute',
        'advance_booking'
    )),
    rule_id UUID REFERENCES dynamic_pricing_rules_ml(rule_id),

    -- Context at time of adjustment
    current_occupancy DECIMAL(5,2),
    predicted_occupancy DECIMAL(5,2),
    days_to_arrival INTEGER,
    booking_pace DECIMAL(5,2),
    competitor_avg_rate DECIMAL(10,2),

    -- Model Details
    ml_model_used VARCHAR(100),
    model_confidence DECIMAL(5,2),
    feature_scores JSONB, -- Which features drove the decision

    -- Approval & Status
    adjustment_status VARCHAR(50) DEFAULT 'applied' CHECK (adjustment_status IN (
        'pending_approval',
        'approved',
        'applied',
        'rejected',
        'rolled_back'
    )),
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITHOUT TIME ZONE,

    -- Impact Tracking
    rooms_sold_after_adjustment INTEGER,
    revenue_after_adjustment DECIMAL(12,2),

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    applied_at TIMESTAMP WITHOUT TIME ZONE
);

COMMENT ON TABLE price_adjustments_history IS 'Audit log of all price adjustments made by ML models or manual overrides';
COMMENT ON COLUMN price_adjustments_history.feature_scores IS 'JSON showing which ML features (occupancy, events, etc.) influenced this price change';

\echo 'price_adjustments_history table created successfully!'
