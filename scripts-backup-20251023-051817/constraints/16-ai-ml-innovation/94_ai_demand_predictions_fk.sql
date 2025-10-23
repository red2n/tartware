-- =============================================
-- Foreign Key Constraints for 94_ai_demand_predictions
-- =============================================

ALTER TABLE ai_demand_predictions ADD CONSTRAINT fk_ai_demand_predictions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE ai_demand_predictions ADD CONSTRAINT fk_ai_demand_predictions_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE ai_demand_predictions ADD CONSTRAINT fk_ai_demand_predictions_room_type_id FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE;
ALTER TABLE demand_scenarios ADD CONSTRAINT fk_demand_scenarios_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE demand_scenarios ADD CONSTRAINT fk_demand_scenarios_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE demand_scenarios ADD CONSTRAINT fk_demand_scenarios_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE demand_scenarios ADD CONSTRAINT fk_demand_scenarios_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE ai_model_performance ADD CONSTRAINT fk_ai_model_performance_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE ai_model_performance ADD CONSTRAINT fk_ai_model_performance_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE ai_model_performance ADD CONSTRAINT fk_ai_model_performance_created_by FOREIGN KEY (created_by) REFERENCES users(id);
