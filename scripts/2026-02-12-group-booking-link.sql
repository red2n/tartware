-- =============================================
-- Migration: Add group_booking_id FK to reservations
-- Purpose: Link individual reservations to their parent group booking
-- Date: 2026-02-12
-- =============================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS group_booking_id UUID REFERENCES group_bookings(group_booking_id);

CREATE INDEX IF NOT EXISTS idx_reservations_group_booking
  ON reservations (tenant_id, group_booking_id)
  WHERE group_booking_id IS NOT NULL AND is_deleted = FALSE;

COMMENT ON COLUMN reservations.group_booking_id IS 'FK to group_bookings for reservations picked up from a group block';
