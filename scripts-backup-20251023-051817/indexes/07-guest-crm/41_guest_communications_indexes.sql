-- Indexes for guest_communications table

-- Primary lookup indexes
CREATE INDEX idx_guest_comm_tenant_property
    ON guest_communications(tenant_id, property_id);

CREATE INDEX idx_guest_comm_guest
    ON guest_communications(guest_id, created_at DESC);

CREATE INDEX idx_guest_comm_reservation
    ON guest_communications(reservation_id, created_at DESC)
    WHERE reservation_id IS NOT NULL;

-- Communication type and direction
CREATE INDEX idx_guest_comm_type
    ON guest_communications(communication_type, created_at DESC);

CREATE INDEX idx_guest_comm_direction
    ON guest_communications(direction, created_at DESC);

CREATE INDEX idx_guest_comm_type_direction
    ON guest_communications(communication_type, direction, created_at DESC);

-- Status tracking
CREATE INDEX idx_guest_comm_status
    ON guest_communications(status, created_at DESC);

CREATE INDEX idx_guest_comm_pending
    ON guest_communications(status, created_at)
    WHERE status IN ('DRAFT', 'QUEUED');

CREATE INDEX idx_guest_comm_failed
    ON guest_communications(status, failed_at DESC)
    WHERE status IN ('FAILED', 'BOUNCED');

-- Email tracking indexes
CREATE INDEX idx_guest_comm_sent
    ON guest_communications(sent_at DESC)
    WHERE sent_at IS NOT NULL;

CREATE INDEX idx_guest_comm_delivered
    ON guest_communications(delivered_at DESC)
    WHERE delivered_at IS NOT NULL;

CREATE INDEX idx_guest_comm_opened
    ON guest_communications(opened_at DESC)
    WHERE opened_at IS NOT NULL;

-- Email/phone search
CREATE INDEX idx_guest_comm_recipient_email
    ON guest_communications(recipient_email)
    WHERE recipient_email IS NOT NULL;

CREATE INDEX idx_guest_comm_recipient_phone
    ON guest_communications(recipient_phone)
    WHERE recipient_phone IS NOT NULL;

-- Template tracking
CREATE INDEX idx_guest_comm_template
    ON guest_communications(template_id, created_at DESC)
    WHERE template_id IS NOT NULL;

-- External message ID lookup
CREATE INDEX idx_guest_comm_external_id
    ON guest_communications(external_message_id)
    WHERE external_message_id IS NOT NULL;

-- Foreign key indexes
CREATE INDEX idx_guest_comm_created_by ON guest_communications(created_by);

-- Timestamp indexes
CREATE INDEX idx_guest_comm_created_at ON guest_communications(created_at DESC);

-- Full-text search on message content
CREATE INDEX idx_guest_comm_message_text ON guest_communications USING gin(to_tsvector('english', message));

-- GIN indexes for JSONB
CREATE INDEX idx_guest_comm_attachments ON guest_communications USING gin(attachments);
CREATE INDEX idx_guest_comm_metadata ON guest_communications USING gin(metadata);

-- Composite index for property communication history
CREATE INDEX idx_guest_comm_property_history
    ON guest_communications(property_id, created_at DESC, communication_type);
