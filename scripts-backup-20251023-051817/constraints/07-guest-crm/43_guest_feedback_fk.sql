-- Foreign key constraints for guest_feedback table

-- Foreign key to tenants
ALTER TABLE guest_feedback
    ADD CONSTRAINT IF NOT EXISTS fk_guest_feedback_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Foreign key to properties
ALTER TABLE guest_feedback
    ADD CONSTRAINT IF NOT EXISTS fk_guest_feedback_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Foreign key to guests
ALTER TABLE guest_feedback
    ADD CONSTRAINT IF NOT EXISTS fk_guest_feedback_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

-- Foreign key to reservations
ALTER TABLE guest_feedback
    ADD CONSTRAINT IF NOT EXISTS fk_guest_feedback_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;

-- Foreign key to users (responded_by)
ALTER TABLE guest_feedback
    ADD CONSTRAINT IF NOT EXISTS fk_guest_feedback_responded_by
    FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL;
