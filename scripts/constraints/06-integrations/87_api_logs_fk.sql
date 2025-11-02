-- Foreign Key Constraints for api_logs table

ALTER TABLE api_logs ADD CONSTRAINT fk_api_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE api_logs ADD CONSTRAINT fk_api_logs_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE api_logs ADD CONSTRAINT fk_api_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
