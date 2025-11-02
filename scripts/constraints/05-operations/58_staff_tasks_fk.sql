-- Foreign key constraints for staff_tasks table

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_delegated_from
    FOREIGN KEY (delegated_from) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_room
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_housekeeping_task
    FOREIGN KEY (housekeeping_task_id) REFERENCES housekeeping_tasks(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_accepted_by
    FOREIGN KEY (accepted_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_completed_by
    FOREIGN KEY (completed_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_blocked_by
    FOREIGN KEY (blocked_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_escalated_to
    FOREIGN KEY (escalated_to) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_parent_task
    FOREIGN KEY (parent_task_id) REFERENCES staff_tasks(task_id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE staff_tasks
    ADD CONSTRAINT fk_staff_tasks_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
