-- =====================================================
-- 13_reservations_partition_prep.sql
-- Prepare a partitioned parent and child partitions for reservations
-- Industry Standard: Declarative partitioning by tenant_id (HASH)
-- Pattern: create partitioned parent and empty child partitions
-- Date: 2026-04-01
-- =====================================================

\c tartware

\echo 'Preparing partitioned parent for reservations (HASH by tenant_id) — no data copy'

CREATE TABLE IF NOT EXISTS reservations_partitioned (
  LIKE reservations INCLUDING DEFAULTS INCLUDING COMMENTS
) PARTITION BY HASH (tenant_id);

COMMENT ON TABLE reservations_partitioned IS 'Partitioned parent for reservations (HASH by tenant_id) — preparatory table, no data copied.';

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
END $$;

\echo 'Partition parent and child partitions created (no data copied).'

-- Recommended adoption flow:
-- 1. Batch copy data into reservations_partitioned.
-- 2. Verify counts, constraints, and query plans.
-- 3. Swap tables during a maintenance window.
-- 4. Recreate any operational indexes and validate application behavior.

\echo 'Partition prep script finished — follow manual migration steps to adopt partitioning.'
