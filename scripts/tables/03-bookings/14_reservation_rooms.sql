-- =====================================================
-- 14_reservation_rooms.sql
-- Reservation Rooms Table
-- Industry Standard: One booking may hold many rooms
-- Pattern: Oracle OPERA reservation "room grid", Mews "space assignment"
-- Date: 2026-08-27
-- =====================================================
--
-- Purpose: One row per physical room held by a reservation. `reservations`
--          previously carried a single room_id / room_type_id, so one booking
--          meant exactly one room. `reservations` keeps the guest, the
--          guarantee and the confirmation number; everything room-shaped
--          lives here, everything price-shaped on reservation_nights.
-- =====================================================

\c tartware

\echo 'Creating reservation_rooms table...'

-- =====================================================
-- RESERVATION_ROOMS TABLE
-- Rooms held by a reservation (1..n per reservation)
-- =====================================================

CREATE TABLE IF NOT EXISTS reservation_rooms (
    -- Primary Key
    reservation_room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Stable identifier referenced by nights and occupants

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL, -- Owning tenant; RLS filter column
    property_id UUID NOT NULL, -- Property the room belongs to

    -- Associations
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE, -- Parent booking
    room_sequence INTEGER NOT NULL DEFAULT 1, -- 1-based position within the booking ("Room 2 of 3")
    room_type_id UUID NOT NULL, -- Room type sold; drives availability and rate lookup
    room_id UUID, -- Assigned room (rooms.id); NULL until a specific room is allocated
    room_number VARCHAR(50), -- Snapshot of the assigned room number, for display without a join
    guest_id UUID, -- Primary occupant of this room; may differ from reservations.guest_id

    -- Occupancy
    adults INTEGER NOT NULL DEFAULT 1, -- Adult headcount for this room
    children INTEGER NOT NULL DEFAULT 0, -- Child headcount for this room
    infants INTEGER NOT NULL DEFAULT 0, -- Infant headcount (usually non-chargeable)

    -- Flags
    do_not_move BOOLEAN NOT NULL DEFAULT FALSE, -- Blocks room-move and auto-assign from relocating this room

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW')), -- Per-room lifecycle; a 3-room booking can be part checked-in

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Extension point for channel or package payloads

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Row creation timestamp
    updated_at TIMESTAMP, -- Last mutation timestamp
    created_by UUID, -- Actor that created the row
    updated_by UUID, -- Actor that last modified the row

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft-delete flag
    deleted_at TIMESTAMP, -- Soft-delete timestamp
    deleted_by UUID, -- Actor that soft-deleted the row

    -- Constraints
    CONSTRAINT reservation_rooms_occupancy_check CHECK (adults >= 0 AND children >= 0 AND infants >= 0),
    CONSTRAINT reservation_rooms_sequence_check CHECK (room_sequence > 0),
    CONSTRAINT reservation_rooms_sequence_unique UNIQUE (reservation_id, room_sequence),

    -- Composite unique for tenant-scoped FK references
    UNIQUE (tenant_id, reservation_room_id)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE reservation_rooms IS 'Rooms held by a reservation — one row per room, so a single booking can hold many.';
COMMENT ON COLUMN reservation_rooms.reservation_room_id IS 'Unique reservation-room identifier (UUID); parent of reservation_nights and reservation_occupants';
COMMENT ON COLUMN reservation_rooms.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN reservation_rooms.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN reservation_rooms.reservation_id IS 'Reference to reservations.id';
COMMENT ON COLUMN reservation_rooms.room_sequence IS '1-based position of this room within the reservation (Room 1 of N)';
COMMENT ON COLUMN reservation_rooms.room_type_id IS 'Reference to room_types.id — the type sold for this room';
COMMENT ON COLUMN reservation_rooms.room_id IS 'Reference to rooms.id once a specific room is assigned (NULL until assignment)';
COMMENT ON COLUMN reservation_rooms.room_number IS 'Snapshot of the assigned room number for display without a join';
COMMENT ON COLUMN reservation_rooms.guest_id IS 'Reference to guests.id — primary occupant of this room (may differ from the booker)';
COMMENT ON COLUMN reservation_rooms.do_not_move IS 'TRUE blocks room-move and auto-assign from relocating this room';
COMMENT ON COLUMN reservation_rooms.status IS 'Per-room lifecycle: PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW';
COMMENT ON COLUMN reservation_rooms.deleted_at IS 'Soft delete timestamp (NULL = active)';

-- =====================================================
-- BACKFILL
-- Additive first: every pre-existing reservation gets exactly one room row
-- carrying the scalars it already had. `reservations.room_id` /
-- `room_type_id` stay in place until every reader has moved off them.
-- =====================================================

INSERT INTO reservation_rooms (
    tenant_id, property_id, reservation_id, room_sequence,
    room_type_id, room_id, room_number, guest_id,
    adults, children, infants, status, created_at
)
SELECT
    r.tenant_id,
    r.property_id,
    r.id,
    1,
    r.room_type_id,
    r.room_id,
    r.room_number,
    r.guest_id,
    GREATEST(COALESCE(r.number_of_adults, 1), 0),
    GREATEST(COALESCE(r.number_of_children, 0), 0),
    GREATEST(COALESCE(r.number_of_infants, 0), 0),
    CASE r.status::text
        WHEN 'CONFIRMED' THEN 'CONFIRMED'
        WHEN 'CHECKED_IN' THEN 'CHECKED_IN'
        WHEN 'CHECKED_OUT' THEN 'CHECKED_OUT'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'NO_SHOW' THEN 'NO_SHOW'
        ELSE 'PENDING'
    END,
    COALESCE(r.created_at, CURRENT_TIMESTAMP)
FROM reservations r
WHERE COALESCE(r.is_deleted, FALSE) = FALSE
ON CONFLICT (reservation_id, room_sequence) DO NOTHING;

\echo '✓ Table created: reservation_rooms'
