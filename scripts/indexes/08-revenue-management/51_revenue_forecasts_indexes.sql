-- =====================================================
-- 51_revenue_forecasts_indexes.sql
-- Revenue Forecasts Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating revenue_forecasts indexes...'

CREATE INDEX idx_revenue_forecasts_tenant ON revenue_forecasts(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_property ON revenue_forecasts(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_date ON revenue_forecasts(forecast_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_period ON revenue_forecasts(forecast_period) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_type ON revenue_forecasts(forecast_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_scenario ON revenue_forecasts(forecast_scenario) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_period_range ON revenue_forecasts(period_start_date, period_end_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_review_status ON revenue_forecasts(review_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_alert ON revenue_forecasts(alert_triggered) WHERE alert_triggered = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_accuracy ON revenue_forecasts(accuracy_score) WHERE accuracy_score IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_variance ON revenue_forecasts(variance_percent) WHERE actual_value IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_model ON revenue_forecasts(model_algorithm, model_version) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_factors ON revenue_forecasts USING gin(factors_included) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_metadata ON revenue_forecasts USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_property_date_type ON revenue_forecasts(property_id, forecast_date DESC, forecast_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_forecasts_property_period ON revenue_forecasts(property_id, period_start_date, period_end_date) WHERE is_deleted = FALSE;

\echo 'Revenue Forecasts indexes created successfully!'
