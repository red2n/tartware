-- Foreign Key Constraints for forecasting_models table

ALTER TABLE forecasting_models ADD CONSTRAINT fk_forecasting_models_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE forecasting_models ADD CONSTRAINT fk_forecasting_models_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE forecasting_models ADD CONSTRAINT fk_forecasting_models_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE forecasting_models ADD CONSTRAINT fk_forecasting_models_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE forecasting_models ADD CONSTRAINT fk_forecasting_models_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
