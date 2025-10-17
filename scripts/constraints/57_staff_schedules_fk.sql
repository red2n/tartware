-- Foreign key constraints for staff_schedules table

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_replacing_user
    FOREIGN KEY (replacing_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_swap_requested_by
    FOREIGN KEY (swap_requested_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_swap_requested_with
    FOREIGN KEY (swap_requested_with) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_swap_approved_by
    FOREIGN KEY (swap_approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_overtime_approved_by
    FOREIGN KEY (overtime_approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_leave_approved_by
    FOREIGN KEY (leave_approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_published_by
    FOREIGN KEY (published_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_parent_schedule
    FOREIGN KEY (parent_schedule_id) REFERENCES staff_schedules(schedule_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE staff_schedules
    ADD CONSTRAINT fk_staff_schedules_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
