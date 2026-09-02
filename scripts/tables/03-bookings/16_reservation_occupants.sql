-- =====================================================
-- 16_reservation_occupants.sql
-- Reservation Occupants Table
-- Industry Standard: Named occupants / accompanying guests per room
-- Pattern: Oracle OPERA "accompanying guests", Mews "space occupants"
-- Date: 2026-08-27
-- =====================================================
--
-- Purpose: Who actually sleeps in each room. The reservation's own guest_id
--          is the booker; registration cards, accompanying-guest capture and
--          share reservations all need the people, not the booker. An
--          occupant may be a name with no profile yet, so guest_id is
--          nullable and full_name is the fallback identity.
-- =====================================================

\c tartware

\echo 'Creating reservation_occupants table...'

-- =====================================================
-- RESERVATION_OCCUPANTS TABLE
-- Named people occupying one reservation room
-- =====================================================

CREATE TABLE IF NOT EXISTS reservation_occupants (
    -- Primary Key
    occupant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Stable identifier for one named occupant

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL, -- Owning tenant; RLS filter column
    property_id UUID NOT NULL, -- Property the stay belongs to

    -- Associations
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE, -- Parent booking
    reservation_room_id UUID NOT NULL REFERENCES reservation_rooms(reservation_room_id) ON DELETE CASCADE, -- Room this person occupies
    guest_id UUID, -- Linked guest profile; NULL for a name-only accompanying guest

    -- Identity
    full_name VARCHAR(255) NOT NULL, -- Display name; the fallback identity when no profile exists
    occupant_type VARCHAR(10) NOT NULL DEFAULT 'ADULT' CHECK (occupant_type IN ('ADULT', 'CHILD', 'INFANT')), -- Occupancy class; drives per-person pricing
    age INTEGER, -- Age at check-in where captured — child rates depend on it
    email VARCHAR(255), -- Contact email for this occupant
    phone VARCHAR(20), -- Contact phone for this occupant

    -- Flags
    is_primary BOOLEAN NOT NULL DEFAULT FALSE, -- The name the room is registered under; at most one per room

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Extension point for document or preference detail

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
    CONSTRAINT reservation_occupants_age_check CHECK (age IS NULL OR (age >= 0 AND age < 130))
);

-- At most one primary occupant per room. Partial unique index rather than a
-- table constraint so non-primary occupants are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservation_occupants_primary
    ON reservation_occupants (reservation_room_id)
    WHERE is_primary AND COALESCE(is_deleted, FALSE) = FALSE;

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE reservation_occupants IS 'Named occupants of a reservation room — accompanying guests and shares, as distinct from the booker on reservations.guest_id.';
COMMENT ON COLUMN reservation_occupants.occupant_id IS 'Unique occupant identifier (UUID)';
COMMENT ON COLUMN reservation_occupants.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN reservation_occupants.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN reservation_occupants.reservation_id IS 'Reference to reservations.id';
COMMENT ON COLUMN reservation_occupants.reservation_room_id IS 'Reference to reservation_rooms.reservation_room_id';
COMMENT ON COLUMN reservation_occupants.guest_id IS 'Reference to guests.id; NULL when the occupant has no profile yet';
COMMENT ON COLUMN reservation_occupants.full_name IS 'Display name — the fallback identity when guest_id is NULL';
COMMENT ON COLUMN reservation_occupants.occupant_type IS 'ADULT, CHILD or INFANT — drives per-person pricing';
COMMENT ON COLUMN reservation_occupants.age IS 'Age at check-in where captured; child rate tiers depend on it';
COMMENT ON COLUMN reservation_occupants.is_primary IS 'TRUE = the name the room is registered under; at most one per room';
COMMENT ON COLUMN reservation_occupants.deleted_at IS 'Soft delete timestamp (NULL = active)';

-- =====================================================
-- BACKFILL
-- Every pre-existing room row gets its booker as the primary occupant, so a
-- registration card has a name to print from day one.
-- =====================================================

INSERT INTO reservation_occupants (
    tenant_id, property_id, reservation_id, reservation_room_id,
    guest_id, full_name, occupant_type, email, phone, is_primary, created_at
)
SELECT
    rr.tenant_id,
    rr.property_id,
    rr.reservation_id,
    rr.reservation_room_id,
    COALESCE(rr.guest_id, r.guest_id),
    COALESCE(NULLIF(TRIM(r.guest_name), ''), 'Unknown Guest'),
    'ADULT',
    r.guest_email,
    r.guest_phone,
    TRUE,
    COALESCE(r.created_at, CURRENT_TIMESTAMP)
FROM reservation_rooms rr
JOIN reservations r ON r.id = rr.reservation_id AND r.tenant_id = rr.tenant_id
WHERE COALESCE(rr.is_deleted, FALSE) = FALSE
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND NOT EXISTS (
      SELECT 1 FROM reservation_occupants o
      WHERE o.reservation_room_id = rr.reservation_room_id
        AND o.is_primary
        AND COALESCE(o.is_deleted, FALSE) = FALSE
  );

\echo '✓ Table created: reservation_occupants'
