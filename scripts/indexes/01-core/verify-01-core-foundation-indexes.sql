-- =====================================================
-- verify-01-core-foundation-indexes.sql
-- Index Verification Script for Core Foundation
-- Category: 01-core-foundation (11 tables)
-- Date: 2025-11-12
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  CORE FOUNDATION - INDEX VERIFICATION'
\echo '  Tables: 11'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. INDEX COUNT BY TABLE
-- =====================================================
\echo '1. Index count by table...'

WITH core_tables AS (
    SELECT unnest(ARRAY[
        'tenants',
        'users',
        'user_tenant_associations',
        'properties',
        'guests',
        'setting_categories',
        'setting_definitions',
        'tenant_settings',
        'property_settings',
        'room_settings',
        'user_settings'
    ]) AS table_name
)
SELECT
    ct.table_name AS tablename,
    COUNT(pi.indexname) AS total_indexes,
    COUNT(CASE WHEN pi.indexname LIKE '%_pkey' THEN 1 END) AS primary_keys,
    COUNT(CASE WHEN pi.indexname NOT LIKE '%_pkey' THEN 1 END) AS secondary_indexes
FROM core_tables ct
LEFT JOIN pg_indexes pi
    ON pi.tablename = ct.table_name
    AND pi.schemaname = 'public'
GROUP BY ct.table_name
ORDER BY ct.table_name;

\echo ''

-- =====================================================
-- 2. FOREIGN KEY COLUMN INDEX COVERAGE
-- =====================================================
\echo '2. Checking foreign key column indexes...'

-- 2. Check foreign key columns have supporting indexes
WITH core_tables AS (
    SELECT unnest(ARRAY[
        'tenants',
        'users',
        'user_tenant_associations',
        'properties',
        'guests',
        'setting_categories',
        'setting_definitions',
        'tenant_settings',
        'property_settings',
        'room_settings',
        'user_settings'
    ]) AS table_name
),
fk_columns AS (
    SELECT
        tc.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name IN (SELECT table_name FROM core_tables)
),
indexed_columns AS (
    SELECT
        pi.tablename,
        trim(split_part(col, ' ', 1)) AS column_name
    FROM pg_indexes pi
    CROSS JOIN LATERAL unnest(
        string_to_array(
            regexp_replace(pi.indexdef, '.*\((.*)\)', '\1'),
            ', '
        )
    ) AS col
    WHERE pi.tablename IN (SELECT table_name FROM core_tables)
        AND pi.schemaname = 'public'
)
SELECT
    fk.table_name,
    fk.column_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM indexed_columns ic
            WHERE ic.tablename = fk.table_name
              AND ic.column_name = fk.column_name
        ) THEN '✓ Indexed'
        ELSE '✗ Missing index'
    END AS status
FROM fk_columns fk
ORDER BY
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM indexed_columns ic
            WHERE ic.tablename = fk.table_name
              AND ic.column_name = fk.column_name
        )
        THEN 1 ELSE 0 END,
    fk.table_name,
    fk.column_name;

\echo ''
-- =====================================================
-- 3. PARTIAL INDEX REVIEW (SOFT DELETE FILTERS)
-- =====================================================
\echo '3. Reviewing partial indexes (soft delete coverage)...'
WITH core_tables AS (
    SELECT unnest(ARRAY[
        'tenants',
        'users',
        'user_tenant_associations',
        'properties',
        'guests',
        'setting_categories',
        'setting_definitions',
        'tenant_settings',
        'property_settings',
        'room_settings',
        'user_settings'
    ]) AS table_name
)
SELECT
    pi.tablename,
    pi.indexname,
    CASE
        WHEN pi.indexdef LIKE '%WHERE%is_deleted = false%' OR pi.indexdef LIKE '%WHERE%deleted_at IS NULL%'
            THEN '✓ Has soft delete filter'
        WHEN pi.indexdef LIKE '%WHERE%' THEN '⚠ Has WHERE but not for soft delete'
        ELSE 'No partial index'
    END AS partial_index_status
FROM pg_indexes pi
WHERE pi.tablename IN (SELECT table_name FROM core_tables)
    AND pi.schemaname = 'public'
    AND pi.indexdef LIKE '%WHERE%'
ORDER BY pi.tablename, pi.indexname;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_tables CONSTANT TEXT[] := ARRAY[
        'tenants',
        'users',
        'user_tenant_associations',
        'properties',
        'guests',
        'setting_categories',
        'setting_definitions',
        'tenant_settings',
        'property_settings',
        'room_settings',
        'user_settings'
    ];
    v_expected_tables INTEGER := array_length(v_tables, 1);
    v_total_indexes INTEGER;
    v_tables_with_indexes INTEGER;
    v_fk_without_index INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_indexes
    FROM pg_indexes
    WHERE tablename = ANY (v_tables)
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';

    SELECT COUNT(DISTINCT tablename) INTO v_tables_with_indexes
    FROM pg_indexes
    WHERE tablename = ANY (v_tables)
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';

    SELECT COUNT(*) INTO v_fk_without_index
    FROM (
        SELECT fk.table_name, fk.column_name
        FROM (
            SELECT
                tc.table_name,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND tc.table_name = ANY (v_tables)
        ) fk
        WHERE NOT EXISTS (
            SELECT 1
            FROM pg_indexes pi
            CROSS JOIN LATERAL unnest(
                string_to_array(
                    regexp_replace(pi.indexdef, '.*\((.*)\)', '\1'),
                    ', '
                )
            ) AS col
            WHERE pi.tablename = fk.table_name
                AND pi.schemaname = 'public'
                AND trim(split_part(col, ' ', 1)) = fk.column_name
        )
    ) missing;

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Core Foundation';
    RAISE NOTICE 'Tables with Secondary Indexes: % / %', v_tables_with_indexes, v_expected_tables;
    RAISE NOTICE 'Foreign Keys Without Index: %', v_fk_without_index;
    RAISE NOTICE 'Total Secondary Indexes: %', v_total_indexes;
    RAISE NOTICE '';

    IF v_fk_without_index = 0 AND v_tables_with_indexes = v_expected_tables THEN
        RAISE NOTICE '✓✓✓ CORE FOUNDATION INDEX VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ CORE FOUNDATION INDEX VERIFICATION ISSUES FOUND ⚠⚠⚠';
        IF v_fk_without_index > 0 THEN
            RAISE WARNING 'Found % foreign keys without indexes!', v_fk_without_index;
        END IF;
        IF v_tables_with_indexes <> v_expected_tables THEN
            RAISE WARNING 'Expected secondary indexes for all %, but found only % tables', v_expected_tables, v_tables_with_indexes;
        END IF;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Core Foundation index verification complete!'
\echo '=============================================='
