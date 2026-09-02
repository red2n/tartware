-- =====================================================
-- 15_reservation_nights.sql
-- Reservation Nights Table
-- Industry Standard: Per-night rate ledger for a stay
-- Pattern: Oracle OPERA "rate grid", Cloudbeds nightly rates
-- Date: 2026-08-27
-- =====================================================
--
-- Purpose: One row per room per night. A flat `reservations.room_rate` cannot
--          express a rate that changes mid-stay, so split-rate stays,
--          mid-stay room changes and per-night overrides were all impossible.
--          Every price read moves off `reservations.room_rate` onto a SUM
--          over this table.
--
--          `stay_date` is the night slept, never the departure date: a
--          3-night stay arriving on the 10th has rows for the 10th, 11th and
--          12th. The stay window is MIN(stay_date) .. MAX(stay_date) + 1.
-- =====================================================

\c tartware

\echo 'Creating reservation_nights table...'

-- =====================================================
-- RESERVATION_NIGHTS TABLE
-- Per-night price and occupancy for one reservation room
-- =====================================================

CREATE TABLE IF NOT EXISTS reservation_nights (
    -- Primary Key
    reservation_night_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Stable identifier for one room-night

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL, -- Owning tenant; RLS filter column
    property_id UUID NOT NULL, -- Property whose business date this night belongs to

    -- Associations
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE, -- Denormalised from reservation_rooms so stay-date sweeps skip a join
    reservation_room_id UUID NOT NULL REFERENCES reservation_rooms(reservation_room_id) ON DELETE CASCADE, -- Room this night belongs to

    -- The Night
    stay_date DATE NOT NULL, -- Night occupied; never the departure date

    -- Pricing
    rate_id UUID, -- Reference to rates.id; NULL for a bespoke price
    rate_code VARCHAR(50), -- Rate code snapshot; survives a later rename of the rate plan
    rate_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00, -- Room charge for this single night, before tax
    currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- ISO 4217 code the amount is quoted in

    -- Occupancy for the night (a stay can change headcount mid-stay)
    adults INTEGER NOT NULL DEFAULT 1, -- Adult headcount for this night
    children INTEGER NOT NULL DEFAULT 0, -- Child headcount for this night

    -- Flags
    is_complimentary BOOLEAN NOT NULL DEFAULT FALSE, -- Comped night: occupies inventory, posts nothing
    is_rate_override BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE when a user priced this night by hand
    rate_override_reason TEXT, -- Justification captured with a manual price

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Extension point for package or allowance detail

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
    CONSTRAINT reservation_nights_amount_check CHECK (rate_amount >= 0),
    CONSTRAINT reservation_nights_occupancy_check CHECK (adults >= 0 AND children >= 0),
    CONSTRAINT reservation_nights_unique UNIQUE (reservation_room_id, stay_date)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE reservation_nights IS 'Per-night rate ledger — one row per reservation room per night slept. SUM(rate_amount) is the room revenue of a stay.';
COMMENT ON COLUMN reservation_nights.reservation_night_id IS 'Unique room-night identifier (UUID)';
COMMENT ON COLUMN reservation_nights.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN reservation_nights.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN reservation_nights.reservation_id IS 'Reference to reservations.id (denormalised from reservation_rooms for stay-date sweeps)';
COMMENT ON COLUMN reservation_nights.reservation_room_id IS 'Reference to reservation_rooms.reservation_room_id';
COMMENT ON COLUMN reservation_nights.stay_date IS 'The night occupied — a stay of N nights has N rows and never includes the departure date';
COMMENT ON COLUMN reservation_nights.rate_id IS 'Reference to rates.id (NULL for a bespoke price)';
COMMENT ON COLUMN reservation_nights.rate_code IS 'Rate code as applied, snapshotted against later renames';
COMMENT ON COLUMN reservation_nights.rate_amount IS 'Room charge for this single night, before tax';
COMMENT ON COLUMN reservation_nights.currency IS 'ISO 4217 currency of rate_amount';
COMMENT ON COLUMN reservation_nights.is_complimentary IS 'TRUE = comped night; occupies inventory, posts nothing';
COMMENT ON COLUMN reservation_nights.is_rate_override IS 'TRUE when the night was priced by hand rather than taken from the rate plan';
COMMENT ON COLUMN reservation_nights.deleted_at IS 'Soft delete timestamp (NULL = active)';

-- =====================================================
-- BACKFILL
-- One night row per date in every pre-existing stay, priced at the flat
-- room_rate the reservation already carried. Runs after 14_reservation_rooms
-- has created the room rows.
-- =====================================================

INSERT INTO reservation_nights (
    tenant_id, property_id, reservation_id, reservation_room_id,
    stay_date, rate_id, rate_amount, currency,
    adults, children, created_at
)
SELECT
    rr.tenant_id,
    rr.property_id,
    rr.reservation_id,
    rr.reservation_room_id,
    night::date,
    r.rate_id,
    COALESCE(r.room_rate, 0.00),
    COALESCE(r.currency, 'USD'),
    rr.adults,
    rr.children,
    COALESCE(r.created_at, CURRENT_TIMESTAMP)
FROM reservation_rooms rr
JOIN reservations r ON r.id = rr.reservation_id AND r.tenant_id = rr.tenant_id
CROSS JOIN LATERAL generate_series(
    r.check_in_date::timestamp,
    (r.check_out_date - INTERVAL '1 day')::timestamp,
    INTERVAL '1 day'
) AS night
WHERE COALESCE(rr.is_deleted, FALSE) = FALSE
  AND COALESCE(r.is_deleted, FALSE) = FALSE
ON CONFLICT (reservation_room_id, stay_date) DO NOTHING;

\echo '✓ Table created: reservation_nights'
