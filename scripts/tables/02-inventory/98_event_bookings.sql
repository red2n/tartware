-- =====================================================
-- 103_event_bookings.sql
-- Event & Function Booking Management
--
-- Purpose: Track event bookings for meeting rooms
-- Industry Standard: OPERA (BOOKING_MASTER), Delphi.fdc (EVENT),
--                    Protel (VERANSTALTUNG), EventPro (FUNCTION)
--
-- Use Cases:
-- - Corporate meetings and conferences
-- - Weddings and receptions
-- - Training seminars
-- - Social events
-- - Multi-day conferences
--
-- Links to meeting_rooms and banquet_event_orders
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS event_bookings CASCADE;

CREATE TABLE event_bookings (
    -- Primary Key
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique event identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL, -- FK tenants.id
    property_id UUID NOT NULL, -- FK properties.id

    -- Event Information
    event_number VARCHAR(50), -- Human-readable event number
    event_name VARCHAR(200) NOT NULL, -- Event title
    event_type VARCHAR(50) NOT NULL
        CHECK (event_type IN ('MEETING', 'CONFERENCE', 'WEDDING', 'BANQUET', 'TRAINING', 'WORKSHOP', 'RECEPTION', 'SEMINAR', 'TRADE_SHOW', 'PARTY', 'FUNDRAISER', 'EXHIBITION', 'OTHER')),

    -- Meeting Room
    meeting_room_id UUID NOT NULL, -- Reference to meeting_rooms

    -- Date & Time
    event_date DATE NOT NULL, -- Calendar date for event
    start_time TIME NOT NULL, -- Scheduled start time
    end_time TIME NOT NULL, -- Scheduled end time
    setup_start_time TIME, -- When setup crew can start
    actual_start_time TIME, -- Actual start time
    actual_end_time TIME, -- Actual end time
    teardown_end_time TIME, -- When room must be clear

    -- Guest/Organizer Information
    organizer_name VARCHAR(200) NOT NULL, -- Primary organizer
    organizer_company VARCHAR(200), -- Company hosting event
    organizer_email VARCHAR(255),
    organizer_phone VARCHAR(20),
    contact_person VARCHAR(200), -- Onsite contact
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),

    -- Linked Entities
    guest_id UUID, -- If booked by hotel guest
    reservation_id UUID, -- If part of hotel stay
    company_id UUID, -- If corporate booking
    group_booking_id UUID, -- If part of group block

    -- Expected Attendance
    expected_attendees INTEGER NOT NULL, -- Forecast headcount
    confirmed_attendees INTEGER, -- Confirmed headcount
    actual_attendees INTEGER, -- Actual turnout
    guarantee_number INTEGER, -- Minimum number for billing

    -- Room Setup
    setup_type VARCHAR(50) NOT NULL
        CHECK (setup_type IN ('THEATER', 'CLASSROOM', 'BANQUET', 'RECEPTION', 'U_SHAPE', 'HOLLOW_SQUARE', 'BOARDROOM', 'CABARET', 'COCKTAIL', 'CUSTOM')),
    setup_details TEXT,
    special_requests TEXT,
    setup_diagram_url VARCHAR(500),

    -- Equipment & AV Requirements
    required_equipment JSONB DEFAULT '[]'::jsonb, -- Non-AV equipment needs
    av_requirements JSONB DEFAULT '[]'::jsonb, -- AV specifics
    technical_contact_name VARCHAR(200),
    technical_contact_phone VARCHAR(20),

    -- Catering
    catering_required BOOLEAN DEFAULT FALSE,
    catering_service_type VARCHAR(50), -- BREAKFAST, LUNCH, DINNER, BREAK, RECEPTION
    food_beverage_minimum DECIMAL(10, 2),
    menu_selections JSONB,
    dietary_restrictions TEXT,
    bar_service_required BOOLEAN DEFAULT FALSE,

    -- Status
    booking_status VARCHAR(20) NOT NULL DEFAULT 'TENTATIVE' -- Overall status
        CHECK (booking_status IN ('INQUIRY', 'TENTATIVE', 'DEFINITE', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    confirmation_status VARCHAR(20),
    payment_status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING', 'DEPOSIT_PAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'WAIVED')),

    -- Dates & Deadlines
    booked_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date booking created
    confirmed_date DATE, -- Date moved to definite status
    beo_due_date DATE, -- Banquet Event Order deadline
    final_count_due_date DATE,
    cancellation_deadline DATE,
    decision_date DATE, -- Convert from tentative to definite

    -- Financial Information
    rental_rate DECIMAL(10, 2), -- Space rental fee
    setup_fee DECIMAL(10, 2), -- Setup labor fee
    equipment_rental_fee DECIMAL(10, 2),
    av_equipment_fee DECIMAL(10, 2),
    labor_charges DECIMAL(10, 2),
    service_charge_percent DECIMAL(5, 2), -- Service charge %
    tax_rate DECIMAL(5, 2), -- Tax rate applied
    estimated_food_beverage DECIMAL(10, 2),
    estimated_total DECIMAL(12, 2),
    actual_total DECIMAL(12, 2),
    currency_code CHAR(3) DEFAULT 'USD',

    -- Deposit & Payment
    deposit_required DECIMAL(10, 2), -- Deposit amount
    deposit_paid DECIMAL(10, 2), -- Amount received
    deposit_due_date DATE,
    final_payment_due DATE,

    -- Linked Documents
    contract_signed BOOLEAN DEFAULT FALSE,
    contract_signed_date DATE,
    contract_url VARCHAR(500),
    beo_pdf_url VARCHAR(500),
    floor_plan_url VARCHAR(500),

    -- Billing
    folio_id UUID, -- Reference to folios for charges
    billing_instructions TEXT,
    billing_contact_name VARCHAR(200),
    billing_contact_email VARCHAR(255),
    payment_method VARCHAR(50),

    -- Marketing & Attribution
    booking_source VARCHAR(50), -- WEB, PHONE, EMAIL, WALK_IN, REFERRAL
    lead_source VARCHAR(100),
    sales_manager_id UUID,
    commission_rate DECIMAL(5, 2),

    -- Post-Event
    post_event_feedback TEXT, -- Feedback notes
    post_event_rating INTEGER CHECK (post_event_rating BETWEEN 1 AND 5), -- Post-event rating
    issues_reported TEXT,
    followup_required BOOLEAN DEFAULT FALSE,

    -- Repeat Booking
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_pattern VARCHAR(100), -- WEEKLY, MONTHLY, YEARLY
    parent_event_id UUID, -- If part of recurring series
    series_id UUID, -- Group recurring events

    -- Risk Management
    security_required BOOLEAN DEFAULT FALSE,
    insurance_required BOOLEAN DEFAULT FALSE,
    insurance_certificate_url VARCHAR(500),
    liability_waiver_signed BOOLEAN DEFAULT FALSE,

    -- Notes
    internal_notes TEXT,
    public_notes TEXT,
    setup_notes TEXT,
    billing_notes TEXT,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Extensibility payload

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP, -- Last update timestamp
    created_by UUID, -- Creator
    updated_by UUID, -- Modifier
    confirmed_by UUID, -- User who confirmed event

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Optimistic Locking
    version BIGINT DEFAULT 0, -- Concurrency version

    -- Constraints
    CONSTRAINT event_bookings_time_check CHECK (end_time > start_time),
    CONSTRAINT event_bookings_setup_time_check CHECK (
        setup_start_time IS NULL OR start_time IS NULL OR setup_start_time <= start_time
    ),
    CONSTRAINT event_bookings_attendees_check CHECK (expected_attendees > 0),
    CONSTRAINT event_bookings_rating_check CHECK (
        post_event_rating IS NULL OR (post_event_rating >= 1 AND post_event_rating <= 5)
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE event_bookings IS 'Event and function bookings for meeting rooms and event spaces';
COMMENT ON COLUMN event_bookings.event_id IS 'Unique event booking identifier (UUID)';
COMMENT ON COLUMN event_bookings.event_number IS 'Human-readable event number (e.g., "EVT-2025-001")';
COMMENT ON COLUMN event_bookings.meeting_room_id IS 'Reference to meeting_rooms.room_id';
COMMENT ON COLUMN event_bookings.setup_type IS 'Room arrangement: THEATER, CLASSROOM, BANQUET, etc.';
COMMENT ON COLUMN event_bookings.guarantee_number IS 'Minimum attendees for billing purposes';
COMMENT ON COLUMN event_bookings.beo_due_date IS 'Deadline for finalized Banquet Event Order';
COMMENT ON COLUMN event_bookings.final_count_due_date IS 'Deadline for final attendee count (usually 72 hours before)';
COMMENT ON COLUMN event_bookings.booking_status IS 'Current status: INQUIRY, TENTATIVE, DEFINITE, CONFIRMED, etc.';
COMMENT ON COLUMN event_bookings.series_id IS 'Groups recurring events together';
COMMENT ON COLUMN event_bookings.metadata IS 'Custom fields and additional event details';

\echo 'Event bookings table created successfully!'
