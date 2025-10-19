-- =====================================================
-- Revenue Forecasts Table
-- =====================================================
-- Purpose: AI-driven revenue forecasting and predictions
-- Key Features:
--   - Daily/weekly/monthly forecasts
--   - Multiple forecast scenarios
--   - Accuracy tracking
--   - Variance analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS revenue_forecasts (
    -- Primary Key
    forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Forecast Period
    forecast_date DATE NOT NULL,
    forecast_period VARCHAR(50) NOT NULL CHECK (forecast_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Forecast Type
    forecast_type VARCHAR(50) NOT NULL CHECK (forecast_type IN ('revenue', 'occupancy', 'adr', 'revpar', 'rooms_sold', 'cancellations')),
    forecast_scenario VARCHAR(50) DEFAULT 'base' CHECK (forecast_scenario IN ('base', 'optimistic', 'pessimistic', 'conservative', 'aggressive')),

    -- Forecast Values
    forecasted_value DECIMAL(12,2) NOT NULL,
    confidence_level DECIMAL(5,2), -- Percentage 0-100
    confidence_interval_low DECIMAL(12,2),
    confidence_interval_high DECIMAL(12,2),

    -- Actual vs Forecast
    actual_value DECIMAL(12,2),
    variance DECIMAL(12,2),
    variance_percent DECIMAL(5,2),
    accuracy_score DECIMAL(5,2),

    -- Breakdown
    room_revenue_forecast DECIMAL(12,2),
    fb_revenue_forecast DECIMAL(12,2),
    other_revenue_forecast DECIMAL(12,2),
    total_revenue_forecast DECIMAL(12,2),

    -- Occupancy Metrics
    forecasted_occupancy_percent DECIMAL(5,2),
    forecasted_adr DECIMAL(10,2),
    forecasted_revpar DECIMAL(10,2),
    forecasted_rooms_sold INTEGER,
    forecasted_room_nights INTEGER,

    -- Model Information
    model_version VARCHAR(50),
    model_algorithm VARCHAR(100) CHECK (model_algorithm IN ('linear_regression', 'arima', 'lstm', 'random_forest', 'xgboost', 'ensemble', 'manual')),
    model_accuracy DECIMAL(5,2),
    training_data_period_days INTEGER,

    -- Factors Considered
    factors_included JSONB, -- {seasonality, events, weather, competitors, etc}
    historical_data_points INTEGER,
    external_factors JSONB,

    -- Market Conditions
    market_demand VARCHAR(50) CHECK (market_demand IN ('very_low', 'low', 'moderate', 'high', 'very_high')),
    market_segment_breakdown JSONB,
    channel_distribution_forecast JSONB,

    -- Events Impact
    events_considered JSONB, -- [{event_name, date, impact_score}]
    events_impact_adjustment DECIMAL(10,2),

    -- Seasonality
    is_peak_season BOOLEAN,
    is_shoulder_season BOOLEAN,
    is_low_season BOOLEAN,
    seasonality_factor DECIMAL(5,4),

    -- Adjustments
    manual_adjustment DECIMAL(10,2) DEFAULT 0.00,
    manual_adjustment_reason TEXT,
    adjusted_by UUID,
    adjusted_at TIMESTAMP WITH TIME ZONE,

    -- Review & Approval
    review_status VARCHAR(50) DEFAULT 'draft' CHECK (review_status IN ('draft', 'pending_review', 'reviewed', 'approved', 'rejected')),
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    -- Alerts
    alert_if_variance_exceeds_percent DECIMAL(5,2) DEFAULT 10.00,
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,

    -- Unique Constraint
    UNIQUE(property_id, forecast_date, forecast_period, forecast_type, forecast_scenario)
);

-- Indexes for revenue_forecasts

-- Composite Indexes

COMMENT ON TABLE revenue_forecasts IS 'AI-driven revenue forecasting with multiple scenarios and accuracy tracking';
COMMENT ON COLUMN revenue_forecasts.confidence_level IS 'Model confidence in forecast (0-100%)';
COMMENT ON COLUMN revenue_forecasts.model_algorithm IS 'Machine learning algorithm used for forecasting';
