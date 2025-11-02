-- Foreign key constraints for communication_templates table

-- Foreign key to tenants
ALTER TABLE communication_templates
    ADD CONSTRAINT fk_comm_template_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Foreign key to properties (optional - NULL means applies to all properties)
ALTER TABLE communication_templates
    ADD CONSTRAINT fk_comm_template_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Foreign key to users (created_by)
ALTER TABLE communication_templates
    ADD CONSTRAINT fk_comm_template_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Foreign key to users (updated_by)
ALTER TABLE communication_templates
    ADD CONSTRAINT fk_comm_template_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
