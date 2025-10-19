-- Foreign key constraints for lost_and_found table

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_found_by
    FOREIGN KEY (found_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_stored_by
    FOREIGN KEY (stored_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_claimed_by_guest
    FOREIGN KEY (claimed_by_guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_returned_by
    FOREIGN KEY (returned_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_disposed_by
    FOREIGN KEY (disposed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE lost_and_found
    ADD CONSTRAINT fk_lost_and_found_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
