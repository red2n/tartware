-- Foreign key constraints for incident_reports table

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_discovered_by
    FOREIGN KEY (discovered_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_first_responder
    FOREIGN KEY (first_responder) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_investigated_by
    FOREIGN KEY (investigated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_management
    FOREIGN KEY (management_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_closed_by
    FOREIGN KEY (closed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_reports_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
