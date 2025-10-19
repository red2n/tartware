-- Foreign key constraints for revenue_forecasts table

ALTER TABLE revenue_forecasts
    ADD CONSTRAINT fk_revenue_forecasts_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE revenue_forecasts
    ADD CONSTRAINT fk_revenue_forecasts_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE revenue_forecasts
    ADD CONSTRAINT fk_revenue_forecasts_adjusted_by
    FOREIGN KEY (adjusted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_forecasts
    ADD CONSTRAINT fk_revenue_forecasts_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_forecasts
    ADD CONSTRAINT fk_revenue_forecasts_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_forecasts
    ADD CONSTRAINT fk_revenue_forecasts_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_forecasts
    ADD CONSTRAINT fk_revenue_forecasts_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
