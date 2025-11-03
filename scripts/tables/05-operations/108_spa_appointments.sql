-- =====================================================
-- 108_spa_appointments.sql
-- Spa & Wellness Appointment Scheduling
--
-- Purpose: Manage guest spa appointments, therapist assignments,
--          resource allocation, and POS posting integration.
-- =====================================================

\c tartware

\echo 'Creating spa_appointments table...'

CREATE TABLE IF NOT EXISTS spa_appointments (
    -- Primary Key
    appointment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Associations
    treatment_id UUID NOT NULL,
    guest_id UUID,
    reservation_id UUID,
    folio_id UUID,

    -- Scheduling
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED')),
    booking_source VARCHAR(30) DEFAULT 'IN_HOUSE' CHECK (booking_source IN ('IN_HOUSE', 'PHONE', 'ONLINE', 'OTA', 'ROOM', 'CORPORATE')),
    booking_notes TEXT,

    -- Staff & Resources
    primary_therapist_id UUID,
    secondary_therapist_id UUID,
    room_id UUID,
    required_resources JSONB DEFAULT '[]'::jsonb,

    -- Guest Preferences
    guest_preferences TEXT,
    special_requests TEXT,
    contraindications TEXT,

    -- Financials
    base_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    gratuity_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2),
    currency CHAR(3) DEFAULT 'USD',
    payment_status VARCHAR(20) DEFAULT 'UNSETTLED' CHECK (payment_status IN ('UNSETTLED', 'POSTED', 'PAID', 'COMPED')),

    -- Cancellation & No-Show
    cancelled_at TIMESTAMP,
    cancelled_by UUID,
    cancellation_reason TEXT,
    no_show_fee DECIMAL(10,2) DEFAULT 0,

    -- Operational Tracking
    check_in_time TIMESTAMP,
    service_start_time TIMESTAMP,
    service_end_time TIMESTAMP,
    check_out_time TIMESTAMP,
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT chk_spa_time_window CHECK (start_time < end_time),
    CONSTRAINT chk_spa_amounts CHECK (
        (base_price IS NULL OR base_price >= 0) AND
        discount_amount >= 0 AND
        tax_amount >= 0 AND
        gratuity_amount >= 0 AND
        (total_amount IS NULL OR total_amount >= 0)
    )
);

COMMENT ON TABLE spa_appointments IS 'Spa appointments linked to reservations/folios.';
COMMENT ON COLUMN spa_appointments.status IS 'Lifecycle status (PENDING → COMPLETED).';
COMMENT ON COLUMN spa_appointments.primary_therapist_id IS 'Assigned therapist (users.id).';
COMMENT ON COLUMN spa_appointments.payment_status IS 'Billing state for the appointment.';

\echo '✓ Table created: spa_appointments'
