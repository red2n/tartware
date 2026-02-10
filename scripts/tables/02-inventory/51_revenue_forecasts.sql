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
    forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique forecast identifier

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Forecast Period
forecast_date DATE NOT NULL, -- Date forecast was generated
forecast_period VARCHAR(50) NOT NULL CHECK (
    forecast_period IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'annual'
    )
), -- Granularity of period
period_start_date DATE NOT NULL, -- Period start date
period_end_date DATE NOT NULL, -- Period end date

-- Forecast Type
forecast_type VARCHAR(50) NOT NULL CHECK (
    forecast_type IN (
        'revenue',
        'occupancy',
        'adr',
        'revpar',
        'rooms_sold',
        'cancellations'
    )
), -- Metric being forecasted
forecast_scenario VARCHAR(50) DEFAULT 'base' CHECK (
    forecast_scenario IN (
        'base',
        'optimistic',
        'pessimistic',
        'conservative',
        'aggressive'
    )
), -- Scenario variant

-- Forecast Values
forecasted_value DECIMAL(12, 2) NOT NULL, -- Predicted value for period
confidence_level DECIMAL(5, 2), -- Model confidence percentage (0-100)
confidence_interval_low DECIMAL(12, 2), -- Lower bound of confidence interval
confidence_interval_high DECIMAL(12, 2), -- Upper bound of confidence interval

-- Actual vs Forecast
actual_value DECIMAL(12, 2), -- Realized value for variance tracking
variance DECIMAL(12, 2), -- Absolute difference (actual - forecasted)
variance_percent DECIMAL(5, 2), -- Percentage variance
accuracy_score DECIMAL(5, 2), -- Accuracy metric for model evaluation

-- Breakdown
room_revenue_forecast DECIMAL(12, 2), -- Component forecast for room revenue
fb_revenue_forecast DECIMAL(12, 2), -- F&B revenue projection
other_revenue_forecast DECIMAL(12, 2), -- Ancillary revenue projection
total_revenue_forecast DECIMAL(12, 2), -- Sum of all components

-- Occupancy Metrics
forecasted_occupancy_percent DECIMAL(5, 2), -- Predicted occupancy percent
forecasted_adr DECIMAL(10, 2), -- Forecasted average daily rate
forecasted_revpar DECIMAL(10, 2), -- Forecasted revenue per available room
forecasted_rooms_sold INTEGER, -- Predicted rooms sold
forecasted_room_nights INTEGER, -- Predicted room nights

-- Model Information
model_version VARCHAR(50), -- Model build/version identifier
model_algorithm VARCHAR(100) CHECK (
    model_algorithm IN (
        'linear_regression',
        'arima',
        'lstm',
        'random_forest',
        'xgboost',
        'ensemble',
        'manual'
    )
), -- Algorithm used
model_accuracy DECIMAL(5, 2), -- Historical model accuracy
training_data_period_days INTEGER, -- Number of days utilized for training

-- Factors Considered
factors_included JSONB, -- JSON array describing features (seasonality, events, etc.)
historical_data_points INTEGER, -- Count of historical records used
external_factors JSONB, -- Weather, macroeconomic indicators, etc.

-- Market Conditions
market_demand VARCHAR(50) CHECK (
    market_demand IN (
        'very_low',
        'low',
        'moderate',
        'high',
        'very_high'
    )
), -- Demand sentiment
market_segment_breakdown JSONB, -- Segment-level contributions
channel_distribution_forecast JSONB, -- Channel mix forecast

-- Events Impact
events_considered JSONB, -- Events influencing forecast
events_impact_adjustment DECIMAL(10, 2), -- Net adjustment due to events

-- Seasonality
is_peak_season BOOLEAN, -- Flag for peak periods
is_shoulder_season BOOLEAN, -- Shoulder season indicator
is_low_season BOOLEAN, -- Low season indicator
seasonality_factor DECIMAL(5, 4), -- Seasonality multiplier applied

-- Adjustments
manual_adjustment DECIMAL(10, 2) DEFAULT 0.00, -- Manual override delta
manual_adjustment_reason TEXT, -- Context for manual changes
adjusted_by UUID, -- User applying manual adjustment
adjusted_at TIMESTAMP WITH TIME ZONE, -- Timestamp of adjustment

-- Review & Approval
review_status VARCHAR(50) DEFAULT 'draft' CHECK (
    review_status IN (
        'draft',
        'pending_review',
        'reviewed',
        'approved',
        'rejected'
    )
), -- Workflow status
reviewed_by UUID, -- Reviewer identifier
reviewed_at TIMESTAMP WITH TIME ZONE, -- Review timestamp
review_notes TEXT, -- Review feedback

-- Alerts
alert_if_variance_exceeds_percent DECIMAL(5, 2) DEFAULT 10.00, -- Threshold for alerting
alert_triggered BOOLEAN DEFAULT FALSE, -- Alert fired flag
alert_sent_at TIMESTAMP WITH TIME ZONE, -- Alert dispatch timestamp

-- Metadata
metadata JSONB, -- Extension payload
tags VARCHAR(100) [], -- Labels for filtering
notes TEXT, -- Additional context

-- Standard Timestamps
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
created_by UUID, -- Creator identifier
updated_by UUID, -- Modifier identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP WITH TIME ZONE, -- Deletion timestamp
deleted_by UUID, -- Deleting user identifier

-- Unique Constraint
UNIQUE(property_id, forecast_date, forecast_period, forecast_type, forecast_scenario)
);

-- Indexes for revenue_forecasts

-- Composite Indexes

COMMENT ON TABLE revenue_forecasts IS 'AI-driven revenue forecasting with multiple scenarios and accuracy tracking';

COMMENT ON COLUMN revenue_forecasts.confidence_level IS 'Model confidence in forecast (0-100%)';

COMMENT ON COLUMN revenue_forecasts.model_algorithm IS 'Machine learning algorithm used for forecasting';

\echo 'revenue_forecasts table created successfully!'

\echo 'revenue_forecasts table created successfully!'

\echo 'revenue_forecasts table created successfully!'
