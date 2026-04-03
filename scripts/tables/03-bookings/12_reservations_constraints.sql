-- =====================================================
-- 12_reservations_constraints.sql
-- Add tenant-scoped uniqueness and overlap protection to reservations
-- Industry Standard: Prevent double-booking via DB constraints
-- Pattern: exclusion constraint (GiST) + tenant-scoped unique indexes
-- Date: 2026-03-30
-- =====================================================

\c tartware

\echo 'Applying reservations constraints migration...'

-- Ensure operator support for exclusion constraints on UUID/text
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add a generated daterange column representing the stay interval
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS stay_daterange daterange
    GENERATED ALWAYS AS (daterange(check_in_date, check_out_date, '[)')) STORED;

-- Replace global UNIQUE confirmation_number with a tenant-scoped unique index.
-- Drop the implicit constraint/index created by the column declaration if present.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_confirmation_number_key;
DROP INDEX IF EXISTS reservations_confirmation_number_idx;
DROP INDEX IF EXISTS reservations_confirmation_number_unique;

CREATE UNIQUE INDEX IF NOT EXISTS ux_reservations_tenant_confirmation
  ON reservations (tenant_id, confirmation_number);

-- Create exclusion constraint to prevent overlapping stays for same tenant/property/room
-- Uses btree_gist to support equality operators on UUIDs and text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_reservations'
  ) THEN
    ALTER TABLE reservations
    ADD CONSTRAINT no_overlapping_reservations
    EXCLUDE USING gist (
      tenant_id WITH =,
      property_id WITH =,
      room_number WITH =,
      stay_daterange WITH &&
    )
    WHERE (is_deleted = FALSE);
  END IF;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'Could not create exclusion constraint: btree_gist or operators missing';
END$$;

-- Helpful verification notes (manual):
-- 1) Verify `stay_daterange` exists: SELECT column_name FROM information_schema.columns WHERE table_name='reservations';
-- 2) Verify exclusion constraint: SELECT conname, contype FROM pg_constraint WHERE conname='no_overlapping_reservations';
-- 3) To reverse: DROP CONSTRAINT IF EXISTS no_overlapping_reservations; DROP INDEX IF EXISTS ux_reservations_tenant_confirmation;

-- PARTITIONING (NOT APPLIED):
-- Partitioning changes are invasive and require careful data migration.
-- Outline (manual steps):
--  a) Create a new partitioned parent `reservations_new` USING HASH (tenant_id) or RANGE (tenant_id) with same columns.
--  b) Create N child partitions (reservations_p0 .. reservations_pN).
--  c) Copy data: INSERT INTO reservations_new SELECT * FROM reservations;
--  d) Recreate FK/indexes on parent/children as needed.
--  e) Rename tables (within maintenance window): ALTER TABLE reservations RENAME TO reservations_old; ALTER TABLE reservations_new RENAME TO reservations;
--  f) Test thoroughly and drop `reservations_old` when ready.

\echo 'Reservations constraints migration complete!'
