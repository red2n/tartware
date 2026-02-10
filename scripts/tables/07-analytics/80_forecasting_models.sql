-- =====================================================
-- forecasting_models.sql
-- Forecasting Models Table
-- Industry Standard: AI/ML revenue management forecasting
-- Pattern: Store forecasting models for demand, revenue, occupancy predictions
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- FORECASTING_MODELS TABLE
-- AI/ML forecasting models for revenue management
-- =====================================================

CREATE TABLE IF NOT EXISTS forecasting_models (
    -- Primary Key
    model_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Model Identification
    model_name VARCHAR(200) NOT NULL,
    model_type VARCHAR(100) CHECK (model_type IN ('demand', 'revenue', 'occupancy', 'pricing', 'cancellations')) NOT NULL,

    -- Model Configuration
    algorithm VARCHAR(100),

    is_active BOOLEAN DEFAULT TRUE,
    accuracy_score DECIMAL(5,2),

    training_data_start DATE,
    training_data_end DATE,
    last_trained_at TIMESTAMP WITH TIME ZONE,

    parameters JSONB,
    predictions JSONB,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


COMMENT ON TABLE forecasting_models IS 'Stores ML forecasting models and predictions';

\echo 'forecasting_models table created successfully!'

\echo 'forecasting_models table created successfully!'

\echo 'forecasting_models table created successfully!'
