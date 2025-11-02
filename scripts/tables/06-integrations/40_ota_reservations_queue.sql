-- =====================================================
-- ota_reservations_queue.sql
-- OTA Reservations Queue Table
-- Industry Standard: Channel Manager reservation processing queue
-- Pattern: Incoming reservations from OTAs waiting to be processed
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- OTA_RESERVATIONS_QUEUE TABLE
-- Incoming reservations from OTAs waiting to be processed
-- =====================================================

CREATE TABLE IF NOT EXISTS ota_reservations_queue (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    ota_configuration_id UUID NOT NULL,

    -- OTA Reservation Identification
    ota_reservation_id VARCHAR(100) NOT NULL, -- OTA's reservation identifier
    ota_booking_reference VARCHAR(100),
    reservation_id UUID, -- Linked to internal reservation after processing

    -- Processing Status
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DUPLICATE'
    processing_attempts INTEGER DEFAULT 0,
    max_retry_attempts INTEGER DEFAULT 3,

    -- Guest Information
    guest_name VARCHAR(200),
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),

    -- Reservation Details
    check_in_date DATE,
    check_out_date DATE,
    room_type VARCHAR(100),
    number_of_guests INTEGER,

    -- Financial
    total_amount DECIMAL(10,2),
    currency_code VARCHAR(3),

    -- Additional Details
    special_requests TEXT,
    raw_payload JSONB, -- Complete OTA XML/JSON payload
    error_message TEXT,

    -- Processing Tracking
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ota_queue_attempts CHECK (processing_attempts >= 0),
    CONSTRAINT chk_ota_queue_dates CHECK (check_out_date > check_in_date)
);

-- Add comments
COMMENT ON TABLE ota_reservations_queue IS 'Queue for incoming OTA reservations awaiting processing';
COMMENT ON COLUMN ota_reservations_queue.raw_payload IS 'Complete XML/JSON payload from OTA';
COMMENT ON COLUMN ota_reservations_queue.processing_attempts IS 'Number of times processing has been attempted';
COMMENT ON COLUMN ota_reservations_queue.status IS 'Processing status: PENDING, PROCESSING, COMPLETED, FAILED, DUPLICATE';
