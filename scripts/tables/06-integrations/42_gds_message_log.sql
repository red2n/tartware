-- =====================================================
-- 42_gds_message_log.sql
-- Global Distribution System (GDS) Message Audit Log
--
-- Purpose: Store inbound/outbound HTNG/OHIP messages for auditing,
--          troubleshooting, and certification.
-- =====================================================

\c tartware

\echo 'Creating gds_message_log table...'

CREATE TABLE IF NOT EXISTS gds_message_log (
    -- Primary Key
    gds_message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Associations
    gds_connection_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Message Details
    message_direction VARCHAR(10) NOT NULL CHECK (message_direction IN ('INBOUND', 'OUTBOUND')),
    message_type VARCHAR(100) NOT NULL, -- ARI_UPDATE, RESERVATION_CREATE, CANCEL, PNR_SYNC, etc.
    correlation_id VARCHAR(100),
    conversation_id VARCHAR(100),
    sequence_number BIGINT,

    -- Payloads
    payload XML,
    payload_hash VARCHAR(128),
    transformed_payload JSONB,

    -- Status & Errors
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'QUEUED', 'PROCESSED', 'FAILED', 'ACKNOWLEDGED')),
    http_status INTEGER,
    ack_code VARCHAR(20),
    ack_message TEXT,
    error_category VARCHAR(50),
    error_details TEXT,

    -- Timing
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    acked_at TIMESTAMP,

    -- Retry Tracking
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP,
    updated_by UUID
);

COMMENT ON TABLE gds_message_log IS 'Audit log of HTNG/OHIP GDS messages exchanged with external systems.';
COMMENT ON COLUMN gds_message_log.message_direction IS 'INBOUND (from GDS) or OUTBOUND (to GDS).';
COMMENT ON COLUMN gds_message_log.message_type IS 'HTNG/OHIP message type.';
COMMENT ON COLUMN gds_message_log.payload IS 'Raw XML payload as received/sent.';
COMMENT ON COLUMN gds_message_log.transformed_payload IS 'Normalized JSON payload stored post-transformation.';
COMMENT ON COLUMN gds_message_log.status IS 'Processing state for the message.';

\echo '✓ Table created: gds_message_log'
