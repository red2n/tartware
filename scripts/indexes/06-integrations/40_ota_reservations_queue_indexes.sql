-- Indexes for ota_reservations_queue table

-- Primary lookup indexes
CREATE INDEX idx_ota_queue_tenant_property
    ON ota_reservations_queue(tenant_id, property_id);

CREATE INDEX idx_ota_queue_ota_config
    ON ota_reservations_queue(ota_configuration_id);

-- Status-based indexes (critical for queue processing)
CREATE INDEX idx_ota_queue_pending
    ON ota_reservations_queue(status, created_at)
    WHERE status = 'PENDING';

CREATE INDEX idx_ota_queue_processing
    ON ota_reservations_queue(status, updated_at)
    WHERE status = 'PROCESSING';

CREATE INDEX idx_ota_queue_failed
    ON ota_reservations_queue(status, processing_attempts, created_at)
    WHERE status = 'FAILED' AND processing_attempts < max_retry_attempts;

-- Reservation lookup
CREATE INDEX idx_ota_queue_reservation_id
    ON ota_reservations_queue(reservation_id)
    WHERE reservation_id IS NOT NULL;

-- OTA reservation ID lookup (detect duplicates)
--
-- UNIQUE, which the comment above always claimed and the index never enforced.
-- Duplicate detection used to be a SELECT inside the drain loop asking whether
-- another queue row carried the same ota_reservation_id, which meant the queue
-- could hold two rows for one booking and stayed correct only because the loop
-- ran one entry at a time. A channel redelivering a booking is not a race to be
-- won at drain time; it is a key that already exists, and the database is where
-- that is decided.
CREATE UNIQUE INDEX idx_ota_queue_ota_reservation_id
    ON ota_reservations_queue(tenant_id, ota_configuration_id, ota_reservation_id);

CREATE INDEX idx_ota_queue_booking_reference
    ON ota_reservations_queue(ota_booking_reference)
    WHERE ota_booking_reference IS NOT NULL;

-- Date range queries
CREATE INDEX idx_ota_queue_check_in_date
    ON ota_reservations_queue(check_in_date);

CREATE INDEX idx_ota_queue_check_in_range
    ON ota_reservations_queue(property_id, check_in_date, status);

-- Processing monitoring
CREATE INDEX idx_ota_queue_processed_at
    ON ota_reservations_queue(processed_at DESC)
    WHERE processed_at IS NOT NULL;

-- Timestamp indexes
CREATE INDEX idx_ota_queue_created_at ON ota_reservations_queue(created_at DESC);
CREATE INDEX idx_ota_queue_updated_at ON ota_reservations_queue(updated_at DESC);

-- Guest search
CREATE INDEX idx_ota_queue_guest_email
    ON ota_reservations_queue(guest_email)
    WHERE guest_email IS NOT NULL;

-- GIN index for JSON payload search
CREATE INDEX idx_ota_queue_raw_payload ON ota_reservations_queue USING gin(raw_payload);
