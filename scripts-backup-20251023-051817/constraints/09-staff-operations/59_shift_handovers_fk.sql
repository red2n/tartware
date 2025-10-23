-- Foreign key constraints for shift_handovers table

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_outgoing_user
    FOREIGN KEY (outgoing_user_id) REFERENCES users(user_id)
    ON DELETE CASCADE;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_incoming_user
    FOREIGN KEY (incoming_user_id) REFERENCES users(user_id)
    ON DELETE CASCADE;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_acknowledged_by
    FOREIGN KEY (acknowledged_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_manager
    FOREIGN KEY (manager_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_previous
    FOREIGN KEY (previous_handover_id) REFERENCES shift_handovers(handover_id)
    ON DELETE SET NULL;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE shift_handovers
    ADD CONSTRAINT fk_shift_handovers_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
