-- Foreign Key Constraints for app_usage_analytics table

ALTER TABLE app_usage_analytics ADD CONSTRAINT fk_app_usage_analytics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE app_usage_analytics ADD CONSTRAINT fk_app_usage_analytics_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE app_usage_analytics ADD CONSTRAINT fk_app_usage_analytics_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL;
