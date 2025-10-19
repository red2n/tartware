
-- Foreign Key Constraints for insurance_claims table

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_incident_report
    FOREIGN KEY (incident_report_id) REFERENCES incident_reports(incident_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_police_report
    FOREIGN KEY (police_report_id) REFERENCES police_reports(report_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_payment_received_by
    FOREIGN KEY (payment_received_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_parent
    FOREIGN KEY (parent_claim_id) REFERENCES insurance_claims(claim_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE insurance_claims
    ADD CONSTRAINT fk_insurance_claims_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
