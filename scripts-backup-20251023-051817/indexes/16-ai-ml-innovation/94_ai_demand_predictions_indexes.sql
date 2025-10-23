-- =============================================
-- Indexes for 94_ai_demand_predictions
-- =============================================

CREATE INDEX idx_ai_demand_predictions_tenant ON ai_demand_predictions(tenant_id);
CREATE INDEX idx_ai_demand_predictions_property ON ai_demand_predictions(property_id);
CREATE INDEX idx_ai_demand_predictions_date ON ai_demand_predictions(prediction_date);
CREATE INDEX idx_ai_demand_predictions_room_type ON ai_demand_predictions(room_type_id);
CREATE INDEX idx_ai_demand_predictions_status ON ai_demand_predictions(status);
CREATE INDEX idx_ai_demand_predictions_model ON ai_demand_predictions(model_name, model_version);
CREATE INDEX idx_ai_demand_predictions_accuracy ON ai_demand_predictions(is_accurate) WHERE actual_occupancy IS NOT NULL;
CREATE INDEX idx_ai_demand_predictions_future ON ai_demand_predictions(prediction_date) WHERE status = 'active' AND prediction_date >= CURRENT_DATE;
CREATE INDEX idx_demand_scenarios_property ON demand_scenarios(property_id);
CREATE INDEX idx_demand_scenarios_dates ON demand_scenarios(start_date, end_date) WHERE is_active = TRUE;
CREATE INDEX idx_demand_scenarios_type ON demand_scenarios(scenario_type);
CREATE INDEX idx_ai_model_performance_model ON ai_model_performance(model_name, model_version);
CREATE INDEX idx_ai_model_performance_date ON ai_model_performance(evaluation_date);
CREATE INDEX idx_ai_model_performance_accuracy ON ai_model_performance(accuracy_percentage DESC);
