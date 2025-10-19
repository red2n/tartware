-- Foreign Key Constraints for webhook_subscriptions table

ALTER TABLE webhook_subscriptions ADD CONSTRAINT fk_webhook_subscriptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
ALTER TABLE webhook_subscriptions ADD CONSTRAINT fk_webhook_subscriptions_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
ALTER TABLE webhook_subscriptions ADD CONSTRAINT fk_webhook_subscriptions_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE webhook_subscriptions ADD CONSTRAINT fk_webhook_subscriptions_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE webhook_subscriptions ADD CONSTRAINT fk_webhook_subscriptions_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id) ON DELETE SET NULL;
