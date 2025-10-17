-- =====================================================
-- Forecasting Models Table
-- =====================================================

CREATE TABLE IF NOT EXISTS forecasting_models (
    model_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(100) CHECK (model_type IN ('demand', 'revenue', 'occupancy', 'pricing', 'cancellation')),
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

CREATE INDEX idx_forecasting_models_tenant ON forecasting_models(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_forecasting_models_property ON forecasting_models(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_forecasting_models_type ON forecasting_models(model_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_forecasting_models_active ON forecasting_models(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;

COMMENT ON TABLE forecasting_models IS 'Stores ML forecasting models and predictions';
