-- =====================================================
-- 43_gds_reservation_queue.sql
-- GDS Reservation Queue
--
-- Purpose: Stage reservation create/modify/cancel messages arriving
--          from GDS providers prior to conversion into PMS bookings.
-- =====================================================

\c tartware

\echo 'Creating gds_reservation_queue table...'

CREATE TABLE IF NOT EXISTS gds_reservation_queue (
    -- Primary Key
    queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Associations
    gds_message_id UUID NOT NULL,
    gds_connection_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Reservation Identifiers
    gds_confirmation_number VARCHAR(100) NOT NULL,
    crs_confirmation_number VARCHAR(100),
    pnr_locator VARCHAR(100),
    reservation_action VARCHAR(20) NOT NULL CHECK (reservation_action IN ('CREATE', 'MODIFY', 'CANCEL')),

    -- Dates & Stay Details
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    room_type_code VARCHAR(50),
    rate_plan_code VARCHAR(50),
    number_of_rooms INTEGER DEFAULT 1,
    number_of_guests INTEGER DEFAULT 1,

    -- Guest Snapshot
    guest_name VARCHAR(255),
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),
    loyalty_number VARCHAR(100),

    -- Billing Snapshot
    guarantee_type VARCHAR(50),
    payment_card_token VARCHAR(255),
    total_amount DECIMAL(15,2),
    currency VARCHAR(3),

    -- Processing State
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DUPLICATE', 'SKIPPED')),
    processing_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    processed_reservation_id UUID,
    failure_reason TEXT,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP,
    updated_by UUID
);

COMMENT ON TABLE gds_reservation_queue IS 'Queue of inbound GDS reservation messages awaiting PMS processing.';
COMMENT ON COLUMN gds_reservation_queue.gds_confirmation_number IS 'Locator assigned by the GDS.';
COMMENT ON COLUMN gds_reservation_queue.reservation_action IS 'Action requested by the message (CREATE/MODIFY/CANCEL).';
COMMENT ON COLUMN gds_reservation_queue.status IS 'Processing state within the PMS queue.';

\echo '✓ Table created: gds_reservation_queue'
