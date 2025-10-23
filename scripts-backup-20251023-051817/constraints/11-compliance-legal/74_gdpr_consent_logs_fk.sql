-- Foreign Key Constraints for gdpr_consent_logs table

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_previous
    FOREIGN KEY (previous_consent_id) REFERENCES gdpr_consent_logs(consent_id)
    ON DELETE SET NULL;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_superseded_by
    FOREIGN KEY (superseded_by_consent_id) REFERENCES gdpr_consent_logs(consent_id)
    ON DELETE SET NULL;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_recorded_by
    FOREIGN KEY (recorded_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_dpo_reviewed_by
    FOREIGN KEY (dpo_reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE gdpr_consent_logs
    ADD CONSTRAINT fk_gdpr_consent_logs_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
