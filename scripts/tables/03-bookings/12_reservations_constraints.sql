-- =====================================================
-- 12_reservations_constraints.sql
-- Reinforce reservations uniqueness and overlap protection
-- Industry Standard: Prevent double-booking via DB constraints
-- Pattern: idempotent exclusion constraint + canonical confirmation index
-- Date: 2026-04-01
-- =====================================================

\c tartware

\echo 'Applying reservations constraints reinforcement...'

-- Ensure operator support for exclusion constraints on UUID/text
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Keep guest-facing confirmation codes globally unique until all lookups are tenant-aware.
DROP INDEX IF EXISTS idx_uk_reservations_tenant_confirmation;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_confirmation
    ON reservations (confirmation_number)
    WHERE deleted_at IS NULL;

-- Backfill the canonical overlap guard for databases created before the constraint was added.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'reservations_no_double_booked_room'
          AND conrelid = 'public.reservations'::regclass
    ) THEN
        ALTER TABLE public.reservations
            ADD CONSTRAINT reservations_no_double_booked_room
            EXCLUDE USING gist (
                tenant_id WITH =,
                property_id WITH =,
                room_number WITH =,
                daterange(check_in_date, check_out_date, '[)') WITH &&
            )
            WHERE (
                room_number IS NOT NULL
                AND deleted_at IS NULL
                AND status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
            );
    END IF;
END $$;

\echo 'Reservations constraints reinforcement complete!'
