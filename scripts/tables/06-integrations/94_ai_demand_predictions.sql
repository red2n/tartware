-- =============================================
-- AI Demand Predictions Table
-- =============================================
-- Description: AI/ML-powered occupancy and demand forecasting
-- Dependencies: properties, room_types
-- Category: Revenue Management - AI/ML
-- =============================================

CREATE TABLE IF NOT EXISTS ai_demand_predictions (
    -- Primary Key
    prediction_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Prediction Target
    prediction_date DATE NOT NULL,
    room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
    all_room_types BOOLEAN DEFAULT FALSE,

    -- Prediction Horizon
    days_ahead INTEGER NOT NULL, -- How many days in advance this prediction was made
    predicted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Demand Predictions
    predicted_demand DECIMAL(5,2) NOT NULL, -- Predicted occupancy % (0-100)
    predicted_rooms_sold INTEGER,
    predicted_rooms_available INTEGER,

    confidence_level DECIMAL(5,2), -- 0-100 (how confident the model is)
    confidence_interval_lower DECIMAL(5,2), -- Lower bound of prediction
    confidence_interval_upper DECIMAL(5,2), -- Upper bound of prediction

    -- Market Segment Breakdown
    predicted_demand_transient DECIMAL(5,2),
    predicted_demand_corporate DECIMAL(5,2),
    predicted_demand_group DECIMAL(5,2),
    predicted_demand_leisure DECIMAL(5,2),

    -- Channel Distribution
    predicted_direct_bookings INTEGER,
    predicted_ota_bookings INTEGER,
    predicted_phone_bookings INTEGER,
    predicted_walkin_bookings INTEGER,

    -- Pricing Predictions
    predicted_adr DECIMAL(10,2), -- Average Daily Rate
    predicted_revpar DECIMAL(10,2), -- Revenue Per Available Room
    predicted_total_revenue DECIMAL(12,2),

    optimal_base_rate DECIMAL(10,2), -- AI-recommended base rate
    optimal_rate_min DECIMAL(10,2),
    optimal_rate_max DECIMAL(10,2),

    -- Demand Drivers & Features
    day_of_week VARCHAR(10),
    is_weekend BOOLEAN,
    is_holiday BOOLEAN,
    local_events TEXT[],
    event_impact_score DECIMAL(5,2), -- 0-100

    season VARCHAR(50),
    weather_forecast VARCHAR(50),
    temperature_forecast DECIMAL(5,2),

    competitor_avg_price DECIMAL(10,2),
    competitor_occupancy DECIMAL(5,2),
    market_demand_index DECIMAL(5,2), -- Market-wide demand indicator

    -- Historical Context
    historical_occupancy_same_dow DECIMAL(5,2), -- Same day of week
    historical_occupancy_last_year DECIMAL(5,2),
    historical_occupancy_last_month DECIMAL(5,2),

    booking_pace DECIMAL(5,2), -- Current booking pace vs historical
    pickup_rate DECIMAL(5,2), -- Rate at which bookings are being picked up

    -- External Factors
    flight_capacity_index DECIMAL(5,2), -- Airline seat availability
    search_volume_index DECIMAL(5,2), -- Google search trends
    social_media_sentiment DECIMAL(5,2), -- -100 to 100
    economic_indicator DECIMAL(10,2),

    -- Model Information
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    model_type VARCHAR(50) CHECK (model_type IN (
        'linear_regression',
        'random_forest',
        'gradient_boosting',
        'neural_network',
        'lstm',
        'ensemble',
        'prophet',
        'arima',
        'other'
    )),

    feature_importance JSONB, -- Which features contributed most to prediction
    training_data_period_start DATE,
    training_data_period_end DATE,
    training_accuracy DECIMAL(5,2),

    -- Actual vs Predicted (populated after the date)
    actual_occupancy DECIMAL(5,2),
    actual_rooms_sold INTEGER,
    actual_adr DECIMAL(10,2),
    actual_revpar DECIMAL(10,2),
    actual_total_revenue DECIMAL(12,2),

    -- Prediction Accuracy
    occupancy_error DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN actual_occupancy IS NOT NULL THEN ABS(predicted_demand - actual_occupancy)
            ELSE NULL
        END
    ) STORED,

    revenue_error DECIMAL(12,2) GENERATED ALWAYS AS (
        CASE
            WHEN actual_total_revenue IS NOT NULL THEN ABS(predicted_total_revenue - actual_total_revenue)
            ELSE NULL
        END
    ) STORED,

    is_accurate BOOLEAN GENERATED ALWAYS AS (
        CASE
            WHEN actual_occupancy IS NOT NULL AND ABS(predicted_demand - actual_occupancy) <= 5.0 THEN TRUE
            WHEN actual_occupancy IS NOT NULL THEN FALSE
            ELSE NULL
        END
    ) STORED,

    -- Actions Taken
    pricing_action_taken VARCHAR(50) CHECK (pricing_action_taken IN (
        'increase',
        'decrease',
        'hold',
        'manual_override',
        'none'
    )),
    rate_adjustment_amount DECIMAL(10,2),
    action_notes TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active',
        'superseded',
        'archived',
        'validated'
    )),

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    CHECK (predicted_demand >= 0 AND predicted_demand <= 100),
    CHECK (confidence_level >= 0 AND confidence_level <= 100),
    UNIQUE (property_id, prediction_date, room_type_id, predicted_at)
);

-- =============================================
-- Demand Scenarios Table
-- =============================================

CREATE TABLE IF NOT EXISTS demand_scenarios (
    -- Primary Key
    scenario_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Scenario Details
    scenario_name VARCHAR(255) NOT NULL,
    scenario_type VARCHAR(50) CHECK (scenario_type IN (
        'best_case',
        'worst_case',
        'most_likely',
        'custom'
    )),
    description TEXT,

    -- Date Range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Scenario Parameters
    demand_adjustment_percentage DECIMAL(5,2), -- +/- adjustment to baseline
    price_elasticity DECIMAL(5,2), -- How demand responds to price changes

    -- External Factors Assumptions
    event_assumptions TEXT[],
    economic_assumptions TEXT,
    competitor_assumptions TEXT,

    -- Predicted Outcomes
    predicted_total_rooms_sold INTEGER,
    predicted_total_revenue DECIMAL(12,2),
    predicted_average_occupancy DECIMAL(5,2),
    predicted_average_adr DECIMAL(10,2),

    -- Probability
    probability DECIMAL(5,2), -- 0-100

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Model Performance Tracking
-- =============================================

CREATE TABLE IF NOT EXISTS ai_model_performance (
    -- Primary Key
    performance_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Model Details
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    model_type VARCHAR(50),

    -- Evaluation Period
    evaluation_date DATE NOT NULL,
    evaluation_period_start DATE NOT NULL,
    evaluation_period_end DATE NOT NULL,

    -- Performance Metrics
    total_predictions INTEGER NOT NULL,
    accurate_predictions INTEGER,
    accuracy_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_predictions > 0 THEN (accurate_predictions::DECIMAL / total_predictions) * 100
            ELSE NULL
        END
    ) STORED,

    mean_absolute_error DECIMAL(10,2), -- MAE
    mean_squared_error DECIMAL(10,2), -- MSE
    root_mean_squared_error DECIMAL(10,2), -- RMSE
    mean_absolute_percentage_error DECIMAL(5,2), -- MAPE

    r_squared DECIMAL(5,4), -- Coefficient of determination

    -- Revenue Impact
    revenue_optimization_amount DECIMAL(12,2), -- Additional revenue from using AI
    revenue_optimization_percentage DECIMAL(5,2),

    -- Recommendations
    retrain_recommended BOOLEAN DEFAULT FALSE,
    feature_engineering_needed BOOLEAN DEFAULT FALSE,
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);


COMMENT ON TABLE ai_demand_predictions IS 'AI/ML-powered demand forecasting and occupancy predictions with confidence intervals';
COMMENT ON TABLE demand_scenarios IS 'What-if scenario analysis for demand planning (best case, worst case, etc.)';
COMMENT ON TABLE ai_model_performance IS 'Track ML model accuracy and performance over time';
COMMENT ON COLUMN ai_demand_predictions.confidence_level IS 'Model confidence in prediction (0-100)';
COMMENT ON COLUMN ai_demand_predictions.occupancy_error IS 'Absolute error between predicted and actual occupancy (computed)';
COMMENT ON COLUMN ai_demand_predictions.feature_importance IS 'JSON showing which features (events, weather, etc.) most influenced prediction';

\echo 'ai_demand_predictions table created successfully!'

\echo 'ai_demand_predictions table created successfully!'

\echo 'ai_demand_predictions table created successfully!'
