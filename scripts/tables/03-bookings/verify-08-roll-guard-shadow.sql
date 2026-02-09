-- =====================================================
-- verify-08-roll-guard-shadow.sql
-- Verification Script for Roll Service & Availability Guard Shadow Tables
-- Category: 03-bookings (shadow observability) - 6 tables
-- Date: 2025-10-19
-- Updated: 2026-02-09
-- =====================================================

\c tartware

\echo ''
\echo '===================================================='
\echo '  CATEGORY: ROLL SERVICE & AVAILABILITY GUARD TABLES'
\echo '  Tables: 6 | Description: Shadow ledgers, checkpoints, audits, guard metadata, inventory locks'
\echo '===================================================='
\echo ''

-- =====================================================
-- 1. CHECK IF ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all 6 tables exist...'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY[
        'roll_service_shadow_ledgers',
        'roll_service_backfill_checkpoint',
        'roll_service_consumer_offsets',
        'inventory_lock_audits',
        'reservation_guard_locks',
        'inventory_locks_shadow'
    ];
    v_table TEXT;
    v_missing_tables TEXT[] := '{}'::TEXT[];
    v_found_count INTEGER := 0;
BEGIN
    FOREACH v_table IN ARRAY v_expected_tables
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = v_table
        ) THEN
            v_found_count := v_found_count + 1;
            RAISE NOTICE '  ✓ % exists', v_table;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table);
            RAISE WARNING '  ✗ % is MISSING', v_table;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing tables: %', array_to_string(v_missing_tables, ', ');
        RAISE EXCEPTION 'Roll/Guard verification FAILED - missing tables!';
    ELSE
        RAISE NOTICE '✓✓✓ All 6 Roll/Guard tables exist!';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. CHECK TABLE STRUCTURE SUMMARY
-- =====================================================
\echo '2. Table structure summary...'

SELECT
    t.table_name,
    COUNT(c.column_name) AS column_count,
    COUNT(CASE WHEN c.column_name = 'tenant_id' THEN 1 END) AS has_tenant_id,
    COUNT(CASE WHEN c.column_name = 'updated_at' THEN 1 END) AS has_updated_at,
    COUNT(CASE WHEN c.column_name = 'metadata' THEN 1 END) AS has_metadata_column
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
   AND t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN (
        'roll_service_shadow_ledgers',
        'roll_service_backfill_checkpoint',
        'roll_service_consumer_offsets',
        'inventory_lock_audits',
        'reservation_guard_locks',
        'inventory_locks_shadow'
    )
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_name;

\echo ''

-- =====================================================
-- 3. CHECK KEY INDEXES / CONSTRAINTS
-- =====================================================
\echo '3. Key indexes / constraints snapshot...'

SELECT
    idx.tablename,
    idx.indexname,
    idx.indexdef
FROM pg_indexes idx
WHERE idx.schemaname = 'public'
  AND idx.tablename IN (
        'roll_service_shadow_ledgers',
        'roll_service_backfill_checkpoint',
        'roll_service_consumer_offsets',
        'inventory_lock_audits',
        'reservation_guard_locks'
    )
ORDER BY idx.tablename, idx.indexname;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '===================================================='
\echo '  ROLL SERVICE & GUARD TABLES - SUMMARY'
\echo '===================================================='

DO $$
DECLARE
    v_table_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_table_count
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name IN (
            'roll_service_shadow_ledgers',
            'roll_service_backfill_checkpoint',
            'roll_service_consumer_offsets',
            'inventory_lock_audits',
            'reservation_guard_locks',
            'inventory_locks_shadow'
        );

    RAISE NOTICE 'Tables Found: % / 6', v_table_count;
    IF v_table_count = 6 THEN
        RAISE NOTICE '✓✓✓ ROLL / GUARD VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ ROLL / GUARD VERIFICATION FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected 6 tables, found %', v_table_count;
    END IF;
    END IF;
END $$;

\echo ''
\echo '===================================================='
\echo 'Roll Service & Guard verification complete!'
\echo '===================================================='
