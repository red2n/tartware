-- Foreign key constraints for guest_communications table

-- Foreign key to tenants
ALTER TABLE guest_communications
    ADD CONSTRAINT fk_guest_comm_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Foreign key to properties
ALTER TABLE guest_communications
    ADD CONSTRAINT fk_guest_comm_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Foreign key to guests
ALTER TABLE guest_communications
    ADD CONSTRAINT fk_guest_comm_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

-- Foreign key to reservations (optional, set NULL if deleted)
ALTER TABLE guest_communications
    ADD CONSTRAINT fk_guest_comm_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

-- Foreign key to communication_templates (optional)
-- Note: This creates a dependency on communication_templates table
ALTER TABLE guest_communications
    ADD CONSTRAINT fk_guest_comm_template
    FOREIGN KEY (template_id) REFERENCES communication_templates(id) ON DELETE SET NULL;

-- Foreign key to users (created_by)
ALTER TABLE guest_communications
    ADD CONSTRAINT fk_guest_comm_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
