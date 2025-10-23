-- =============================================
-- Indexes for 95_dynamic_pricing_rules_ml
-- =============================================

CREATE INDEX idx_dynamic_pricing_rules_ml_tenant ON dynamic_pricing_rules_ml(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_dynamic_pricing_rules_ml_property ON dynamic_pricing_rules_ml(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_dynamic_pricing_rules_ml_active ON dynamic_pricing_rules_ml(is_active, is_automated) WHERE is_deleted = FALSE;
CREATE INDEX idx_dynamic_pricing_rules_ml_dates ON dynamic_pricing_rules_ml(effective_from, effective_to) WHERE is_active = TRUE;
CREATE INDEX idx_dynamic_pricing_rules_ml_room_type ON dynamic_pricing_rules_ml(room_type_id);
CREATE INDEX idx_dynamic_pricing_rules_ml_strategy ON dynamic_pricing_rules_ml(pricing_strategy);
CREATE INDEX idx_price_adjustments_history_property ON price_adjustments_history(property_id);
CREATE INDEX idx_price_adjustments_history_room_type ON price_adjustments_history(room_type_id);
CREATE INDEX idx_price_adjustments_history_date ON price_adjustments_history(target_date);
CREATE INDEX idx_price_adjustments_history_trigger ON price_adjustments_history(adjustment_trigger);
CREATE INDEX idx_price_adjustments_history_created ON price_adjustments_history(created_at DESC);
CREATE INDEX idx_price_adjustments_history_status ON price_adjustments_history(adjustment_status);
CREATE INDEX idx_pricing_experiments_property ON pricing_experiments(property_id);
CREATE INDEX idx_pricing_experiments_status ON pricing_experiments(status);
CREATE INDEX idx_pricing_experiments_dates ON pricing_experiments(start_date, end_date);
