-- Guest Communications Table
-- All communication history with guests (emails, SMS, calls, etc.)

CREATE TABLE IF NOT EXISTS guest_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    guest_id UUID NOT NULL,
    reservation_id UUID, -- Optional link to specific reservation
    communication_type VARCHAR(50) NOT NULL, -- 'EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'IN_PERSON', 'CHAT'
    direction VARCHAR(20) NOT NULL, -- 'INBOUND', 'OUTBOUND'
    subject VARCHAR(500),
    message TEXT NOT NULL,
    sender_name VARCHAR(200),
    sender_email VARCHAR(255),
    sender_phone VARCHAR(50),
    recipient_name VARCHAR(200),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    template_id UUID, -- Link to communication_templates if used
    status VARCHAR(50) DEFAULT 'SENT', -- 'DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'OPENED', 'CLICKED'
    external_message_id VARCHAR(200), -- ID from email/SMS provider
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    attachments JSONB, -- Array of attachment metadata
    metadata JSONB, -- Additional tracking data
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_guest_comm_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_comm_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_comm_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_comm_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
    CONSTRAINT fk_guest_comm_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Add comments
COMMENT ON TABLE guest_communications IS 'All communication history with guests across all channels';
COMMENT ON COLUMN guest_communications.communication_type IS 'Type: EMAIL, SMS, PHONE, WHATSAPP, IN_PERSON, CHAT';
COMMENT ON COLUMN guest_communications.direction IS 'Communication direction: INBOUND or OUTBOUND';
COMMENT ON COLUMN guest_communications.status IS 'Message status: DRAFT, QUEUED, SENT, DELIVERED, FAILED, BOUNCED, OPENED, CLICKED';
COMMENT ON COLUMN guest_communications.attachments IS 'Array of attachment metadata in JSON format';
