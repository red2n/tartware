-- Foreign key constraints for demand_calendar table

ALTER TABLE demand_calendar
    ADD CONSTRAINT fk_demand_calendar_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE demand_calendar
    ADD CONSTRAINT fk_demand_calendar_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE demand_calendar
    ADD CONSTRAINT fk_demand_calendar_action_taken_by
    FOREIGN KEY (action_taken_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE demand_calendar
    ADD CONSTRAINT fk_demand_calendar_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE demand_calendar
    ADD CONSTRAINT fk_demand_calendar_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE demand_calendar
    ADD CONSTRAINT fk_demand_calendar_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
