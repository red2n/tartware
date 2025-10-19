-- Indexes for communication_templates table

-- Primary lookup indexes
CREATE INDEX idx_comm_template_tenant
    ON communication_templates(tenant_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_comm_template_property
    ON communication_templates(property_id)
    WHERE deleted_at IS NULL AND property_id IS NOT NULL;

CREATE INDEX idx_comm_template_tenant_property
    ON communication_templates(tenant_id, property_id)
    WHERE deleted_at IS NULL;

-- Template code lookup
CREATE INDEX idx_comm_template_code
    ON communication_templates(template_code)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_comm_template_code_language
    ON communication_templates(template_code, language_code)
    WHERE deleted_at IS NULL;

-- Communication type
CREATE INDEX idx_comm_template_type
    ON communication_templates(communication_type)
    WHERE deleted_at IS NULL;

-- Category
CREATE INDEX idx_comm_template_category
    ON communication_templates(category)
    WHERE deleted_at IS NULL AND category IS NOT NULL;

-- Active templates
CREATE INDEX idx_comm_template_active
    ON communication_templates(tenant_id, is_active)
    WHERE deleted_at IS NULL AND is_active = true;

-- Automated templates (critical for background jobs)
CREATE INDEX idx_comm_template_automated
    ON communication_templates(tenant_id, is_automated, trigger_event)
    WHERE deleted_at IS NULL AND is_automated = true AND is_active = true;

CREATE INDEX idx_comm_template_trigger_event
    ON communication_templates(trigger_event, trigger_offset_hours)
    WHERE deleted_at IS NULL AND is_automated = true AND is_active = true;

-- Language lookup
CREATE INDEX idx_comm_template_language
    ON communication_templates(language_code)
    WHERE deleted_at IS NULL;

-- Usage tracking
CREATE INDEX idx_comm_template_usage
    ON communication_templates(usage_count DESC, last_used_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_comm_template_last_used
    ON communication_templates(last_used_at DESC)
    WHERE deleted_at IS NULL AND last_used_at IS NOT NULL;

-- Foreign key indexes
CREATE INDEX idx_comm_template_created_by ON communication_templates(created_by);
CREATE INDEX idx_comm_template_updated_by ON communication_templates(updated_by);

-- Timestamp indexes
CREATE INDEX idx_comm_template_created_at ON communication_templates(created_at);
CREATE INDEX idx_comm_template_updated_at ON communication_templates(updated_at);

-- Full-text search on template name and body
CREATE INDEX idx_comm_template_name_text
    ON communication_templates USING gin(to_tsvector('english', template_name));

CREATE INDEX idx_comm_template_body_text
    ON communication_templates USING gin(to_tsvector('english', body));

-- GIN indexes for JSONB
CREATE INDEX idx_comm_template_variables ON communication_templates USING gin(variables);
CREATE INDEX idx_comm_template_metadata ON communication_templates USING gin(metadata);

-- Composite index for finding templates
CREATE INDEX idx_comm_template_lookup
    ON communication_templates(tenant_id, property_id, communication_type, category, is_active)
    WHERE deleted_at IS NULL;
