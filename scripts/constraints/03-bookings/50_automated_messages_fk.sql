-- Foreign key constraints for automated_messages table

ALTER TABLE automated_messages
    ADD CONSTRAINT fk_automated_messages_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE automated_messages
    ADD CONSTRAINT fk_automated_messages_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE automated_messages
    ADD CONSTRAINT fk_automated_messages_template
    FOREIGN KEY (template_id) REFERENCES communication_templates(id)
    ON DELETE SET NULL;

ALTER TABLE automated_messages
    ADD CONSTRAINT fk_automated_messages_fallback_template
    FOREIGN KEY (fallback_template_id) REFERENCES communication_templates(id)
    ON DELETE SET NULL;

ALTER TABLE automated_messages
    ADD CONSTRAINT fk_automated_messages_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE automated_messages
    ADD CONSTRAINT fk_automated_messages_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE automated_messages
    ADD CONSTRAINT fk_automated_messages_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
