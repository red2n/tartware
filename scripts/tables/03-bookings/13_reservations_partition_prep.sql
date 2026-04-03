-- =====================================================
-- 13_reservations_partition_prep.sql
-- Prepare a partitioned parent and child partitions for `reservations`
-- Industry Standard: Declarative partitioning by tenant_id (HASH)
-- Pattern: create partitioned parent (LIKE reservations) and N hash partitions
-- Date: 2026-03-30
-- =====================================================

\c tartware

\echo 'Preparing partitioned parent for reservations (HASH by tenant_id) — NO DATA COPY'

-- Create a partitioned parent table that mirrors `reservations` column definitions and defaults.
-- This does NOT copy indexes, constraints or comments that are incompatible with partitioning.
CREATE TABLE IF NOT EXISTS reservations_partitioned (
  LIKE reservations INCLUDING DEFAULTS INCLUDING COMMENTS
) PARTITION BY HASH (tenant_id);

COMMENT ON TABLE reservations_partitioned IS 'Partitioned parent for reservations (HASH by tenant_id) — preparatory table, no data yet.';

-- Create 8 hash partitions (modulus 8). Adjust modulus as needed for tenant cardinality.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p0') THEN
    CREATE TABLE reservations_p0 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p1') THEN
    CREATE TABLE reservations_p1 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p2') THEN
    CREATE TABLE reservations_p2 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p3') THEN
    CREATE TABLE reservations_p3 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p4') THEN
    CREATE TABLE reservations_p4 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p5') THEN
    CREATE TABLE reservations_p5 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p6') THEN
    CREATE TABLE reservations_p6 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reservations_p7') THEN
    CREATE TABLE reservations_p7 PARTITION OF reservations_partitioned FOR VALUES WITH (MODULUS 8, REMAINDER 7);
  END IF;
END$$;

\echo 'Partition parent and child partitions created (no data copied).'

-- IMPORTANT: This script only sets up the parent and empty partitions. Do NOT swap tables in production without a tested plan.
-- Recommended migration steps to adopt partitioned table:
-- 1) Run this prep script on a standby or maintenance DB and test queries.
-- 2) Batch-copy data into partitions: INSERT INTO reservations_partitioned SELECT * FROM reservations WHERE ... (use batching and indexes)
-- 3) Verify row counts and integrity per partition.
-- 4) During a maintenance window, rename tables atomically:
--    BEGIN;
--      ALTER TABLE reservations RENAME TO reservations_old;
--      ALTER TABLE reservations_partitioned RENAME TO reservations;
--    COMMIT;
-- 5) Recreate any necessary triggers, FK references, and indexes on the new partitioned parent/children.
-- 6) After a period of verification, DROP TABLE reservations_old;

\echo 'Partition prep script finished — follow manual migration steps to adopt partitioning.'
