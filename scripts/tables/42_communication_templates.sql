-- Communication Templates Table
-- Pre-built message templates for guest communications

CREATE TABLE IF NOT EXISTS communication_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID, -- NULL means template applies to all properties
    template_name VARCHAR(200) NOT NULL,
    template_code VARCHAR(100) NOT NULL, -- 'PRE_ARRIVAL', 'CHECK_IN_INSTRUCTIONS', 'THANK_YOU', etc.
    communication_type VARCHAR(50) NOT NULL, -- 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH_NOTIFICATION'
    category VARCHAR(50), -- 'BOOKING', 'ARRIVAL', 'STAY', 'DEPARTURE', 'MARKETING', 'OPERATIONAL'
    subject VARCHAR(500),
    body TEXT NOT NULL,
    html_body TEXT, -- HTML version for emails
    language_code VARCHAR(10) DEFAULT 'en',
    variables JSONB, -- Available template variables
    is_active BOOLEAN DEFAULT true,
    is_automated BOOLEAN DEFAULT false, -- Auto-send based on trigger
    trigger_event VARCHAR(100), -- 'BOOKING_CONFIRMED', 'CHECK_IN_MINUS_24H', 'CHECK_OUT', etc.
    trigger_offset_hours INTEGER, -- Hours before/after trigger event
    send_priority INTEGER DEFAULT 0,
    from_name VARCHAR(200),
    from_email VARCHAR(255),
    from_phone VARCHAR(50),
    reply_to_email VARCHAR(255),
    cc_emails VARCHAR(500),
    bcc_emails VARCHAR(500),
    attachments JSONB, -- Default attachments
    metadata JSONB,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_comm_template_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_comm_template_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_comm_template_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_comm_template_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_comm_template_code UNIQUE (tenant_id, property_id, template_code, language_code)
);

-- Add comments
COMMENT ON TABLE communication_templates IS 'Pre-built message templates for automated and manual guest communications';
COMMENT ON COLUMN communication_templates.template_code IS 'Unique identifier code for template';
COMMENT ON COLUMN communication_templates.variables IS 'Available template variables like {{guest_name}}, {{check_in_date}}';
COMMENT ON COLUMN communication_templates.is_automated IS 'If true, sends automatically based on trigger';
COMMENT ON COLUMN communication_templates.trigger_event IS 'Event that triggers auto-send';
COMMENT ON COLUMN communication_templates.trigger_offset_hours IS 'Hours before (-) or after (+) trigger event';
