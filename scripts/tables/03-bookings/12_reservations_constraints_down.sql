-- =====================================================
-- 12_reservations_constraints_down.sql
-- Revert: tenant-scoped uniqueness and overlap protection for reservations
-- Industry Standard: safe revert of exclusion constraint + index + generated column
-- Pattern: idempotent drop operations with checks
-- Date: 2026-03-30
-- =====================================================

\c tartware

\echo 'Reverting reservations constraints migration...'

-- DROP exclusion constraint if present
ALTER TABLE IF EXISTS reservations DROP CONSTRAINT IF EXISTS no_overlapping_reservations;

-- DROP tenant-scoped unique index if present
DROP INDEX IF EXISTS ux_reservations_tenant_confirmation;

-- Attempt to recreate the original global unique on confirmation_number only if no duplicates exist
DO $$
DECLARE
  v_dup_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT confirmation_number FROM reservations WHERE confirmation_number IS NOT NULL GROUP BY confirmation_number HAVING COUNT(*) > 1
  ) t;

  IF v_dup_count = 0 THEN
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS reservations_confirmation_number_unique ON reservations (confirmation_number);
      RAISE NOTICE 'Global unique index on confirmation_number created.';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create global unique index on confirmation_number: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Skipping recreation of global unique on confirmation_number: % duplicate values found', v_dup_count;
  END IF;
END$$;

-- DROP the generated daterange column (must drop dependent constraints first)
ALTER TABLE IF EXISTS reservations DROP COLUMN IF EXISTS stay_daterange;

-- NOTE: We DO NOT automatically drop the btree_gist extension here because other objects may depend on it.
-- If you intentionally want to remove the extension, run:
--   DROP EXTENSION IF EXISTS btree_gist;

\echo 'Revert complete.'
