-- =====================================================
-- guest_communications.sql
-- Guest Communications Table
-- Industry Standard: CRM communication history
-- Pattern: All communication history with guests (emails, SMS, calls, etc.)
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- GUEST_COMMUNICATIONS TABLE
-- All communication history with guests across all channels
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_communications (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    guest_id UUID NOT NULL,
    reservation_id UUID, -- Optional link to specific reservation
    template_id UUID, -- Link to communication_templates if used

    -- Communication Classification
    communication_type VARCHAR(50) NOT NULL, -- 'EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'IN_PERSON', 'CHAT'
    direction VARCHAR(20) NOT NULL, -- 'INBOUND', 'OUTBOUND'

    -- Message Content
    subject VARCHAR(500),
    message TEXT NOT NULL,

    -- Sender Information
    sender_name VARCHAR(200),
    sender_email VARCHAR(255),
    sender_phone VARCHAR(50),

    -- Recipient Information
    recipient_name VARCHAR(200),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),

    -- Status & Tracking
    status VARCHAR(50) DEFAULT 'SENT', -- 'DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'OPENED', 'CLICKED'
    external_message_id VARCHAR(200), -- ID from email/SMS provider

    -- Delivery Tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,

    -- Additional Data
    attachments JSONB, -- Array of attachment metadata
    metadata JSONB, -- Additional tracking data

    -- Audit Fields
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE guest_communications IS 'All communication history with guests across all channels';
COMMENT ON COLUMN guest_communications.communication_type IS 'Type: EMAIL, SMS, PHONE, WHATSAPP, IN_PERSON, CHAT';
COMMENT ON COLUMN guest_communications.direction IS 'Communication direction: INBOUND or OUTBOUND';
COMMENT ON COLUMN guest_communications.status IS 'Message status: DRAFT, QUEUED, SENT, DELIVERED, FAILED, BOUNCED, OPENED, CLICKED';
COMMENT ON COLUMN guest_communications.attachments IS 'Array of attachment metadata in JSON format';

\echo 'guest_communications table created successfully!'

\echo 'guest_communications table created successfully!'

\echo 'guest_communications table created successfully!'
