-- Foreign key constraints for guest_loyalty_programs table

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE CASCADE;

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_enrollment_property
    FOREIGN KEY (enrollment_property_id) REFERENCES properties(id)
    ON DELETE SET NULL;

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_referred_by
    FOREIGN KEY (referred_by_guest_id) REFERENCES guests(id)
    ON DELETE SET NULL;

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE guest_loyalty_programs
    ADD CONSTRAINT fk_guest_loyalty_programs_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
