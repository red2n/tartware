-- =====================================================
-- 80_forecasting_models_indexes.sql
-- Forecasting Models Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating forecasting_models indexes...'

CREATE INDEX idx_forecasting_models_tenant ON forecasting_models(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_forecasting_models_property ON forecasting_models(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_forecasting_models_type ON forecasting_models(model_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_forecasting_models_active ON forecasting_models(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;

\echo 'Forecasting Models indexes created successfully!'
