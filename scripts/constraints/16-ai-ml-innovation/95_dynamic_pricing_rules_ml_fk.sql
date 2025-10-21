-- =============================================
-- Foreign Key Constraints for 95_dynamic_pricing_rules_ml
-- =============================================

ALTER TABLE dynamic_pricing_rules_ml ADD CONSTRAINT fk_dynamic_pricing_rules_ml_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE dynamic_pricing_rules_ml ADD CONSTRAINT fk_dynamic_pricing_rules_ml_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE dynamic_pricing_rules_ml ADD CONSTRAINT fk_dynamic_pricing_rules_ml_room_type_id FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE;
ALTER TABLE dynamic_pricing_rules_ml ADD CONSTRAINT fk_dynamic_pricing_rules_ml_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE dynamic_pricing_rules_ml ADD CONSTRAINT fk_dynamic_pricing_rules_ml_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE dynamic_pricing_rules_ml ADD CONSTRAINT fk_dynamic_pricing_rules_ml_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
ALTER TABLE price_adjustments_history ADD CONSTRAINT fk_price_adjustments_history_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE price_adjustments_history ADD CONSTRAINT fk_price_adjustments_history_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE price_adjustments_history ADD CONSTRAINT fk_price_adjustments_history_room_type_id FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE;
ALTER TABLE price_adjustments_history ADD CONSTRAINT fk_price_adjustments_history_rule_id FOREIGN KEY (rule_id) REFERENCES dynamic_pricing_rules_ml(rule_id);
ALTER TABLE price_adjustments_history ADD CONSTRAINT fk_price_adjustments_history_approved_by FOREIGN KEY (approved_by) REFERENCES users(id);
ALTER TABLE pricing_experiments ADD CONSTRAINT fk_pricing_experiments_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE pricing_experiments ADD CONSTRAINT fk_pricing_experiments_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE pricing_experiments ADD CONSTRAINT fk_pricing_experiments_control_rule_id FOREIGN KEY (control_rule_id) REFERENCES dynamic_pricing_rules_ml(rule_id);
ALTER TABLE pricing_experiments ADD CONSTRAINT fk_pricing_experiments_test_rule_id FOREIGN KEY (test_rule_id) REFERENCES dynamic_pricing_rules_ml(rule_id);
ALTER TABLE pricing_experiments ADD CONSTRAINT fk_pricing_experiments_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE pricing_experiments ADD CONSTRAINT fk_pricing_experiments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
