-- =====================================================
-- verify-03-reservations-booking-indexes.sql
-- Index Verification Script for Reservations & Booking
-- Category: 03-reservations-booking (14 tables)
-- Date: 2025-10-19
-- Updated: 2026-02-12
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  RESERVATIONS & BOOKING - INDEX VERIFICATION'
\echo '  Tables: 14'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK INDEX COUNT BY TABLE
-- =====================================================
\echo '1. Index count by table...'

SELECT
    tablename,
    COUNT(*) AS total_indexes,
    COUNT(CASE WHEN indexname LIKE '%_pkey' THEN 1 END) AS primary_keys,
    COUNT(CASE WHEN indexname NOT LIKE '%_pkey' THEN 1 END) AS secondary_indexes
FROM pg_indexes
WHERE tablename IN (
    'reservations',
    'reservation_status_history',
    'deposit_schedules',
    'allotments',
    'booking_sources',
    'market_segments',
    'guest_preferences',
    'reservation_traces',
    'waitlist_entries',
    'reservation_event_offsets',
    'reservation_command_lifecycle',
    'reservation_rate_fallbacks',
    'overbooking_config',
    'walk_history'
)
    AND schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- =====================================================
-- 2. CHECK FOREIGN KEY INDEXES
-- =====================================================
\echo '2. Checking if foreign key columns are indexed...'

WITH fk_columns AS (
    SELECT
        tc.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN (
            'reservations',
            'reservation_status_history',
            'deposit_schedules',
            'allotments',
            'booking_sources',
            'market_segments',
            'guest_preferences',
            'reservation_traces',
            'waitlist_entries',
            'reservation_event_offsets',
            'reservation_command_lifecycle',
            'reservation_rate_fallbacks',
            'overbooking_config',
            'walk_history'
        )
),
indexed_columns AS (
    SELECT
        rel.relname AS tablename,
        att.attname AS column_name
    FROM pg_index i
    JOIN pg_class rel ON rel.oid = i.indrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(i.indkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
    JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = ord.attnum
    WHERE rel.relname IN (SELECT DISTINCT table_name FROM fk_columns)
        AND nsp.nspname IN ('public', 'availability')
        AND i.indisvalid
        AND i.indisready
)
SELECT
    fk.table_name,
    fk.column_name,
    CASE
        WHEN ic.column_name IS NOT NULL THEN '✓ Indexed'
        ELSE '✗ Missing index'
    END AS status
FROM fk_columns fk
LEFT JOIN indexed_columns ic
    ON fk.table_name = ic.tablename
    AND fk.column_name = ic.column_name
ORDER BY
    CASE WHEN ic.column_name IS NULL THEN 0 ELSE 1 END,
    fk.table_name;

\echo ''

-- =====================================================
-- 3. CHECK PARTIAL INDEXES (for soft delete)
-- =====================================================
\echo '3. Checking partial indexes for soft delete...'

SELECT
    tablename,
    indexname,
    CASE
        WHEN indexdef LIKE '%WHERE%is_deleted = false%' OR indexdef LIKE '%WHERE%deleted_at IS NULL%'
        THEN '✓ Has soft delete filter'
        WHEN indexdef LIKE '%WHERE%' THEN '⚠ Has WHERE but not for soft delete'
        ELSE 'No partial index'
    END AS partial_index_status
FROM pg_indexes
WHERE tablename IN (
    'reservations',
    'reservation_status_history',
    'deposit_schedules',
    'allotments',
    'booking_sources',
    'market_segments',
    'guest_preferences',
    'reservation_traces',
    'waitlist_entries',
    'reservation_event_offsets',
    'reservation_command_lifecycle',
    'reservation_rate_fallbacks',
    'overbooking_config',
    'walk_history'
)
    AND schemaname = 'public'
    AND indexdef LIKE '%WHERE%'
ORDER BY tablename, indexname;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_total_indexes INTEGER;
    v_tables_with_indexes INTEGER;
    v_fk_without_index INTEGER;
BEGIN
    -- Count total indexes (excluding primary keys)
    SELECT COUNT(*) INTO v_total_indexes
    FROM pg_indexes
    WHERE tablename IN (
        'reservations',
        'reservation_status_history',
        'deposit_schedules',
        'allotments',
        'booking_sources',
        'market_segments',
        'guest_preferences',
        'reservation_traces',
        'waitlist_entries',
        'reservation_event_offsets',
        'reservation_command_lifecycle',
        'reservation_rate_fallbacks',
        'overbooking_config',
        'walk_history'
    )
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';

    -- Count tables that have at least one secondary index
    SELECT COUNT(DISTINCT tablename) INTO v_tables_with_indexes
    FROM pg_indexes
    WHERE tablename IN ('reservations', 'reservation_status_history', 'deposit_schedules', 'allotments', 'booking_sources', 'market_segments', 'guest_preferences', 'reservation_traces', 'waitlist_entries', 'reservation_event_offsets', 'reservation_command_lifecycle', 'reservation_rate_fallbacks', 'overbooking_config', 'walk_history')
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';

    -- Count FKs without indexes
    SELECT COUNT(*) INTO v_fk_without_index
    FROM (
        SELECT
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN ('reservations',
                'reservation_status_history',
                'deposit_schedules',
                'allotments',
                'booking_sources',
                'market_segments',
                'guest_preferences',
                'reservation_traces',
                'waitlist_entries',
                'reservation_event_offsets',
                'reservation_command_lifecycle',
                'reservation_rate_fallbacks',
                'overbooking_config',
                'walk_history')
    ) fk
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class rel ON rel.oid = i.indrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN unnest(i.indkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
        JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = ord.attnum
        WHERE rel.relname = fk.table_name
            AND nsp.nspname IN ('public', 'availability')
            AND i.indisvalid
            AND i.indisready
            AND att.attname = fk.column_name
    );

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Reservations & Booking';
    RAISE NOTICE 'Total Secondary Indexes: %', v_total_indexes;
    RAISE NOTICE 'Tables with Indexes: % / 14', v_tables_with_indexes;
    RAISE NOTICE 'Foreign Keys Without Index: %', v_fk_without_index;
    RAISE NOTICE '';

    IF v_fk_without_index = 0 AND v_tables_with_indexes = 14 THEN
        RAISE NOTICE '✓✓✓ RESERVATIONS & BOOKING INDEX VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ RESERVATIONS & BOOKING INDEX VERIFICATION ISSUES FOUND ⚠⚠⚠';
        IF v_fk_without_index > 0 THEN
            RAISE WARNING 'Found % foreign keys without indexes!', v_fk_without_index;
        END IF;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Reservations & Booking index verification complete!'
\echo '=============================================='
