-- Foreign Key Constraints for police_reports table

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_incident_report
    FOREIGN KEY (incident_report_id) REFERENCES incident_reports(incident_id)
    ON DELETE SET NULL;

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_room
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE SET NULL;

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_parent
    FOREIGN KEY (parent_report_id) REFERENCES police_reports(report_id)
    ON DELETE SET NULL;

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE police_reports
    ADD CONSTRAINT fk_police_reports_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
