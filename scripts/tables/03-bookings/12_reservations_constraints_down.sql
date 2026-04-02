-- =====================================================
-- 12_reservations_constraints_down.sql
-- Revert overlap-protection reinforcement for reservations
-- Industry Standard: safe revert of optional post-create constraints
-- Pattern: idempotent drop operations
-- Date: 2026-04-01
-- =====================================================

\c tartware

\echo 'Reverting reservations constraint reinforcement...'

-- Preserve the canonical confirmation-number uniqueness; only remove the overlap guard.
ALTER TABLE IF EXISTS reservations
    DROP CONSTRAINT IF EXISTS reservations_no_double_booked_room;

\echo 'Reservations constraint reinforcement reverted.'
