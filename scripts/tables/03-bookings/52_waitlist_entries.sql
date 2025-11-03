-- =====================================================
-- 52_waitlist_entries.sql
-- Reservation Waitlist Management
--
-- Purpose: Track guests waiting for availability on sold-out dates,
--          with prioritization and auto-notification support.
-- =====================================================

\c tartware

\echo 'Creating waitlist_entries table...'

CREATE TABLE IF NOT EXISTS waitlist_entries (
    -- Primary Key
    waitlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Guest & Reservation Context
    guest_id UUID,
    reservation_id UUID,
    requested_room_type_id UUID,
    requested_rate_id UUID,

    -- Stay Details
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    nights INTEGER GENERATED ALWAYS AS (GREATEST(0, departure_date - arrival_date)) STORED,
    number_of_rooms INTEGER DEFAULT 1 CHECK (number_of_rooms > 0),
    number_of_adults INTEGER DEFAULT 1 CHECK (number_of_adults > 0),
    number_of_children INTEGER DEFAULT 0,
    flexibility VARCHAR(20) DEFAULT 'NONE' CHECK (flexibility IN ('NONE', 'DATE', 'ROOM_TYPE', 'EITHER')),

    -- Priority & Status
    waitlist_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (waitlist_status IN ('ACTIVE', 'OFFERED', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
    priority_score INTEGER DEFAULT 0,
    vip_flag BOOLEAN DEFAULT FALSE,
    notes TEXT,

    -- Offers & Notifications
    last_notified_at TIMESTAMP,
    last_notified_via VARCHAR(30) CHECK (last_notified_via IN ('EMAIL', 'SMS', 'PHONE', 'PORTAL')),
    offer_expiration_at TIMESTAMP,
    offer_response VARCHAR(20) CHECK (offer_response IN ('ACCEPTED', 'DECLINED', 'PENDING')),
    offer_response_at TIMESTAMP,

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
    CONSTRAINT chk_waitlist_dates CHECK (arrival_date < departure_date)
);

COMMENT ON TABLE waitlist_entries IS 'Waitlist requests for room availability.';
COMMENT ON COLUMN waitlist_entries.flexibility IS 'Guest flexibility preference (DATE, ROOM_TYPE, etc.).';
COMMENT ON COLUMN waitlist_entries.waitlist_status IS 'Lifecycle state of the waitlist entry.';

\echo '✓ Table created: waitlist_entries'
