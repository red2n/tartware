
-- Foreign Key Constraints for revenue_attribution table

ALTER TABLE revenue_attribution ADD CONSTRAINT fk_revenue_attribution_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
ALTER TABLE revenue_attribution ADD CONSTRAINT fk_revenue_attribution_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
ALTER TABLE revenue_attribution ADD CONSTRAINT fk_revenue_attribution_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE;
ALTER TABLE revenue_attribution ADD CONSTRAINT fk_revenue_attribution_campaign FOREIGN KEY (primary_campaign_id) REFERENCES marketing_campaigns(campaign_id) ON DELETE SET NULL;
ALTER TABLE revenue_attribution ADD CONSTRAINT fk_revenue_attribution_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE revenue_attribution ADD CONSTRAINT fk_revenue_attribution_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE revenue_attribution ADD CONSTRAINT fk_revenue_attribution_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id) ON DELETE SET NULL;
