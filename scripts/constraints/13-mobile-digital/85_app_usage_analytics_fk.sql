-- Foreign Key Constraints for app_usage_analytics table

ALTER TABLE app_usage_analytics ADD CONSTRAINT fk_app_usage_analytics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
ALTER TABLE app_usage_analytics ADD CONSTRAINT fk_app_usage_analytics_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
ALTER TABLE app_usage_analytics ADD CONSTRAINT fk_app_usage_analytics_guest FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE SET NULL;
ALTER TABLE app_usage_analytics ADD CONSTRAINT fk_app_usage_analytics_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
