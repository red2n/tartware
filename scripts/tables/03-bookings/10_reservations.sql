-- =====================================================
-- reservations.sql
-- Reservations Table
-- Industry Standard: Bookings/Reservations
-- Pattern: Oracle OPERA Reservation, Cloudbeds Booking
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating reservations table...'

-- =====================================================
-- RESERVATIONS TABLE
-- Guest bookings (core transaction table)
-- Central entity linking guests, rooms, rates, payments
-- =====================================================

CREATE TABLE IF NOT EXISTS reservations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    guest_id UUID NOT NULL,
    room_type_id UUID NOT NULL,
    rate_id UUID,

    -- Reservation Number (human-readable)
    confirmation_number VARCHAR(50) UNIQUE NOT NULL,

    -- Dates
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    booking_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Actual Check-in/out (NULL until completed)
    actual_check_in TIMESTAMP,
    actual_check_out TIMESTAMP,

    -- Room Assignment (NULL until assigned)
    room_number VARCHAR(50),

    -- Guests & Occupancy
    number_of_adults INTEGER NOT NULL DEFAULT 1,
    number_of_children INTEGER DEFAULT 0,
    number_of_infants INTEGER DEFAULT 0,

    -- Pricing
    room_rate DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0.00,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status
    status reservation_status NOT NULL DEFAULT 'PENDING',

    -- Booking Source
    source reservation_source NOT NULL DEFAULT 'DIRECT',
    channel_reference VARCHAR(100),

    -- Guest Details (snapshot at booking time)
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(20),

    -- Special Requests
    special_requests TEXT,
    internal_notes TEXT,

    -- Guarantee & Payment
    guarantee_type VARCHAR(50),
    credit_card_last4 VARCHAR(4),

    -- Cancellation
    cancellation_date TIMESTAMP,
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(15,2) DEFAULT 0.00,

    -- No-Show
    is_no_show BOOLEAN DEFAULT false,
    no_show_date TIMESTAMP,
    no_show_fee DECIMAL(15,2) DEFAULT 0.00,

    -- Reservation Classification
    reservation_type reservation_type NOT NULL DEFAULT 'TRANSIENT',

    -- ETA & Corporate/Agency Links
    eta TIME,
    company_id UUID,
    travel_agent_id UUID,

    -- Quote Lifecycle (INQUIRY → QUOTED → PENDING)
    quoted_at TIMESTAMPTZ,
    quote_expires_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,

    -- Marketing
    promo_code VARCHAR(50),

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT reservations_dates_check CHECK (check_in_date < check_out_date),
    CONSTRAINT reservations_occupancy_check CHECK (number_of_adults > 0),
    CONSTRAINT reservations_amounts_check CHECK (
        room_rate >= 0 AND
        total_amount >= 0 AND
        tax_amount >= 0 AND
        discount_amount >= 0 AND
        paid_amount >= 0
    ),
    CONSTRAINT reservations_email_format CHECK (guest_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE reservations IS 'Guest reservations/bookings (core transaction table)';
COMMENT ON COLUMN reservations.id IS 'Unique reservation identifier (UUID)';
COMMENT ON COLUMN reservations.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN reservations.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN reservations.guest_id IS 'Reference to guests.id';
COMMENT ON COLUMN reservations.room_type_id IS 'Reference to room_types.id';
COMMENT ON COLUMN reservations.rate_id IS 'Reference to rates.id (NULL if custom rate)';
COMMENT ON COLUMN reservations.confirmation_number IS 'Human-readable confirmation number (e.g., CNF123456)';
COMMENT ON COLUMN reservations.room_number IS 'Assigned room number (NULL until assigned)';
COMMENT ON COLUMN reservations.actual_check_in IS 'Actual check-in timestamp (NULL until checked in)';
COMMENT ON COLUMN reservations.actual_check_out IS 'Actual check-out timestamp (NULL until checked out)';
COMMENT ON COLUMN reservations.status IS 'ENUM: pending, confirmed, checked_in, checked_out, cancelled, no_show';
COMMENT ON COLUMN reservations.source IS 'ENUM: direct, ota, phone, walk_in, corporate, group, channel_manager';
COMMENT ON COLUMN reservations.balance_due IS 'Computed: total_amount - paid_amount';
COMMENT ON COLUMN reservations.is_no_show IS 'Guest did not arrive';
COMMENT ON COLUMN reservations.reservation_type IS 'PMS industry-standard reservation classification (TRANSIENT, CORPORATE, GROUP, etc.)';
COMMENT ON COLUMN reservations.eta IS 'Estimated time of arrival (HH:MM)';
COMMENT ON COLUMN reservations.company_id IS 'Corporate account FK for negotiated-rate bookings';
COMMENT ON COLUMN reservations.travel_agent_id IS 'Travel agency FK for agent-booked reservations';
COMMENT ON COLUMN reservations.quoted_at IS 'When the quote was sent to the guest';
COMMENT ON COLUMN reservations.quote_expires_at IS 'When the quote validity expires (auto-expire target)';
COMMENT ON COLUMN reservations.expired_at IS 'When the reservation was transitioned to EXPIRED';
COMMENT ON COLUMN reservations.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Reservations table created successfully!'
