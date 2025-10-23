-- Foreign key constraints for guest_notes table

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE CASCADE;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE SET NULL;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_acknowledged_by
    FOREIGN KEY (acknowledged_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_parent
    FOREIGN KEY (parent_note_id) REFERENCES guest_notes(note_id)
    ON DELETE SET NULL;

ALTER TABLE guest_notes
    ADD CONSTRAINT fk_guest_notes_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
