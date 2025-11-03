-- =====================================================
-- 43_gds_reservation_queue_indexes.sql
-- Indexes for GDS Reservation Queue
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating gds_reservation_queue indexes...'

CREATE INDEX idx_gds_reservation_queue_connection_status
    ON gds_reservation_queue(gds_connection_id, status);

CREATE INDEX idx_gds_reservation_queue_tenant_action
    ON gds_reservation_queue(tenant_id, reservation_action, status);

CREATE INDEX idx_gds_reservation_queue_confirmation
    ON gds_reservation_queue(gds_confirmation_number);

CREATE INDEX idx_gds_reservation_queue_arrival
    ON gds_reservation_queue(arrival_date, status);

CREATE INDEX idx_gds_reservation_queue_processing
    ON gds_reservation_queue(processing_attempts, last_attempt_at)
    WHERE processing_attempts > 0;

CREATE INDEX idx_gds_reservation_queue_processed_reservation
    ON gds_reservation_queue(processed_reservation_id)
    WHERE processed_reservation_id IS NOT NULL;

CREATE INDEX idx_gds_reservation_queue_failure
    ON gds_reservation_queue(status, failure_reason)
    WHERE failure_reason IS NOT NULL;

\echo 'gds_reservation_queue indexes created.'
