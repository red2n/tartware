-- =====================================================
-- 42_gds_message_log_indexes.sql
-- Indexes for GDS Message Log
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating gds_message_log indexes...'

CREATE INDEX idx_gds_message_log_connection_time
    ON gds_message_log(gds_connection_id, received_at);

CREATE INDEX idx_gds_message_log_tenant_type
    ON gds_message_log(tenant_id, message_type, status);

CREATE INDEX idx_gds_message_log_direction
    ON gds_message_log(message_direction, status);

CREATE INDEX idx_gds_message_log_correlation
    ON gds_message_log(correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX idx_gds_message_log_conversation
    ON gds_message_log(conversation_id)
    WHERE conversation_id IS NOT NULL;

CREATE INDEX idx_gds_message_log_retry
    ON gds_message_log(status, next_retry_at)
    WHERE next_retry_at IS NOT NULL;

CREATE INDEX idx_gds_message_log_ack
    ON gds_message_log(ack_code, acked_at)
    WHERE ack_code IS NOT NULL;

CREATE INDEX idx_gds_message_log_payload_json
    ON gds_message_log USING gin(transformed_payload)
    WHERE transformed_payload IS NOT NULL;

\echo 'gds_message_log indexes created.'
