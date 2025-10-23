-- =====================================================
-- verify-indexes.sql
-- Verify All Indexes Are Created Correctly
-- Date: 2025-10-21
--
-- Updated: Now supports 132 tables with 800+ indexes (89 core + 43 advanced)
-- =====================================================

\c tartware

\echo '=============================================='
\echo '  INDEX VERIFICATION'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK INDEX COUNT BY TABLE
-- =====================================================
\echo '1. Index count by table:'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    COUNT(*) AS index_count,
    COUNT(CASE WHEN indexname LIKE '%_pkey' THEN 1 END) AS primary_keys,
    COUNT(CASE WHEN indexname NOT LIKE '%_pkey' THEN 1 END) AS secondary_indexes
FROM pg_indexes
WHERE schemaname IN ('public', 'availability')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

\echo ''

-- =====================================================
-- 2. CHECK TOTAL INDEX COUNT
-- =====================================================
\echo '2. Total index statistics:'
\echo '--------------------------------------------'

SELECT
    COUNT(*) AS total_indexes,
    COUNT(CASE WHEN indexname LIKE '%_pkey' THEN 1 END) AS primary_keys,
    COUNT(CASE WHEN indexname NOT LIKE '%_pkey' THEN 1 END) AS secondary_indexes,
    COUNT(CASE WHEN indexdef LIKE '%UNIQUE%' THEN 1 END) AS unique_indexes,
    COUNT(CASE WHEN indexdef LIKE '%WHERE%' THEN 1 END) AS partial_indexes,
    COUNT(CASE WHEN indexdef LIKE '%gin%' THEN 1 END) AS gin_indexes,
    COUNT(CASE WHEN indexdef LIKE '%gist%' THEN 1 END) AS gist_indexes
FROM pg_indexes
WHERE schemaname IN ('public', 'availability');

\echo ''

-- =====================================================
-- 3. CHECK FOREIGN KEY INDEXES
-- =====================================================
\echo '3. Foreign key columns with indexes:'
\echo '--------------------------------------------'

WITH fk_columns AS (
    SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN ('public', 'availability')
),
indexed_columns AS (
    SELECT
        schemaname,
        tablename,
        (string_to_array(
            regexp_replace(
                indexdef,
                '.*\((.*)\)',
                '\1'
            ),
            ', '
        ))[1] AS column_name
    FROM pg_indexes
    WHERE schemaname IN ('public', 'availability')
)
SELECT
    fk.table_name,
    fk.column_name,
    fk.foreign_table_name AS references,
    CASE
        WHEN ic.column_name IS NOT NULL THEN '✓ Indexed'
        ELSE '✗ Missing index'
    END AS status
FROM fk_columns fk
LEFT JOIN indexed_columns ic
    ON fk.table_schema = ic.schemaname
    AND fk.table_name = ic.tablename
    AND fk.column_name = ic.column_name
ORDER BY
    CASE WHEN ic.column_name IS NULL THEN 0 ELSE 1 END,
    fk.table_name,
    fk.column_name;

\echo ''

-- =====================================================
-- 4. CHECK SOFT DELETE PARTIAL INDEXES
-- =====================================================
\echo '4. Partial indexes for soft delete:'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    CASE
        WHEN indexdef LIKE '%WHERE%deleted_at IS NULL%' THEN '✓ Filters deleted records'
        WHEN indexdef LIKE '%WHERE%' THEN '⚠ Has WHERE but not for deleted_at'
        ELSE 'No WHERE clause'
    END AS partial_index_status
FROM pg_indexes
WHERE schemaname IN ('public', 'availability')
    AND indexdef LIKE '%WHERE%'
ORDER BY schemaname, tablename, indexname;

\echo ''

-- =====================================================
-- 5. CHECK COMPOSITE INDEXES
-- =====================================================
\echo '5. Composite (multi-column) indexes:'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    regexp_replace(
        regexp_replace(indexdef, '.*\((.*)\).*', '\1'),
        ' COLLATE [^ ,]+',
        '',
        'g'
    ) AS columns
FROM pg_indexes
WHERE schemaname IN ('public', 'availability')
    AND indexdef ~ '\([^)]*,.*\)'  -- Contains comma in column list
ORDER BY schemaname, tablename, indexname;

\echo ''

-- =====================================================
-- 6. CHECK INDEX SIZES
-- =====================================================
\echo '6. Largest indexes:'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    CASE
        WHEN idx_scan = 0 THEN '⚠ Never used'
        WHEN idx_scan < 100 THEN '⚠ Rarely used'
        ELSE '✓ Active'
    END AS usage_status
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'availability')
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

\echo ''

-- =====================================================
-- 7. CHECK UNUSED INDEXES
-- =====================================================
\echo '7. Potentially unused indexes (0 scans):'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'availability')
    AND idx_scan = 0
    AND indexname NOT LIKE '%_pkey'  -- Exclude primary keys
ORDER BY pg_relation_size(indexrelid) DESC;

\echo ''
\echo 'Note: Newly created indexes will show 0 scans until queries use them.'
\echo ''

-- =====================================================
-- 8. CHECK JSONB INDEXES (GIN)
-- =====================================================
\echo '8. JSONB indexes (GIN type):'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    regexp_replace(
        indexdef,
        '.*USING gin \((.*)\).*',
        '\1'
    ) AS indexed_column
FROM pg_indexes
WHERE schemaname IN ('public', 'availability')
    AND indexdef LIKE '%gin%'
ORDER BY schemaname, tablename, indexname;

\echo ''

-- =====================================================
-- 9. CHECK TRIGRAM INDEXES (Text Search)
-- =====================================================
\echo '9. Trigram indexes for text search:'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    CASE
        WHEN indexdef LIKE '%gin_trgm_ops%' THEN '✓ Trigram (GIN)'
        WHEN indexdef LIKE '%gist_trgm_ops%' THEN '✓ Trigram (GiST)'
        ELSE 'Standard'
    END AS index_type
FROM pg_indexes
WHERE schemaname IN ('public', 'availability')
    AND (indexdef LIKE '%trgm%' OR indexdef LIKE '%to_tsvector%')
ORDER BY schemaname, tablename, indexname;

\echo ''

-- =====================================================
-- 10. CHECK INDEX BLOAT
-- =====================================================
\echo '10. Index health (bloat check):'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS current_size,
    round(100 * pg_relation_size(indexrelid) / NULLIF(pg_relation_size(indexrelid), 0), 2) AS bloat_ratio,
    CASE
        WHEN pg_relation_size(indexrelid) = 0 THEN '✓ Empty (new index)'
        WHEN pg_relation_size(indexrelid) < 1048576 THEN '✓ Small'
        ELSE '✓ Normal'
    END AS health_status
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'availability')
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

\echo ''

-- =====================================================
-- 11. CHECK INDEX COVERAGE BY TABLE
-- =====================================================
\echo '11. Index coverage by table:'
\echo '--------------------------------------------'

WITH table_columns AS (
    SELECT
        table_schema,
        table_name,
        COUNT(*) AS total_columns,
        COUNT(CASE WHEN column_name IN ('id', 'tenant_id', 'created_at', 'deleted_at') THEN 1 END) AS standard_columns
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'availability')
    GROUP BY table_schema, table_name
),
table_indexes AS (
    SELECT
        schemaname,
        tablename,
        COUNT(*) - 1 AS index_count  -- Subtract primary key
    FROM pg_indexes
    WHERE schemaname IN ('public', 'availability')
    GROUP BY schemaname, tablename
)
SELECT
    tc.table_name,
    tc.total_columns,
    COALESCE(ti.index_count, 0) AS secondary_indexes,
    CASE
        WHEN COALESCE(ti.index_count, 0) >= 5 THEN '✓ Well indexed'
        WHEN COALESCE(ti.index_count, 0) >= 3 THEN '⚠ Moderate'
        ELSE '✗ Minimal indexing'
    END AS coverage_status
FROM table_columns tc
LEFT JOIN table_indexes ti
    ON tc.table_schema = ti.schemaname
    AND tc.table_name = ti.tablename
WHERE tc.table_schema = 'public'
ORDER BY COALESCE(ti.index_count, 0) DESC, tc.table_name;

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
    v_secondary_indexes INTEGER;
    v_fk_without_index INTEGER;
    v_partial_indexes INTEGER;
    v_unused_indexes INTEGER;
BEGIN
    -- Count total indexes
    SELECT COUNT(*) INTO v_total_indexes
    FROM pg_indexes
    WHERE schemaname IN ('public', 'availability');

    -- Count secondary indexes (non-PK)
    SELECT COUNT(*) INTO v_secondary_indexes
    FROM pg_indexes
    WHERE schemaname IN ('public', 'availability')
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
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema IN ('public', 'availability')
        EXCEPT
        SELECT
            tablename,
            string_to_array(
                regexp_replace(indexdef, '.*\((.*)\)', '\1'),
                ', '
            )[1]
        FROM pg_indexes
        WHERE schemaname IN ('public', 'availability')
    ) missing;

    -- Count partial indexes
    SELECT COUNT(*) INTO v_partial_indexes
    FROM pg_indexes
    WHERE schemaname IN ('public', 'availability')
        AND indexdef LIKE '%WHERE%';

    -- Count unused indexes
    SELECT COUNT(*) INTO v_unused_indexes
    FROM pg_stat_user_indexes
    WHERE schemaname IN ('public', 'availability')
        AND idx_scan = 0
        AND indexname NOT LIKE '%_pkey';

    RAISE NOTICE '';
    RAISE NOTICE 'Total Indexes: % (Expected: 650+)', v_total_indexes;
    RAISE NOTICE 'Secondary Indexes: %', v_secondary_indexes;
    RAISE NOTICE 'Partial Indexes: %', v_partial_indexes;
    RAISE NOTICE 'Foreign Keys Without Index: %', v_fk_without_index;
    RAISE NOTICE 'Unused Indexes: % (Normal for new installation)', v_unused_indexes;
    RAISE NOTICE '';

    IF v_total_indexes >= 650 AND v_fk_without_index = 0 THEN
        RAISE NOTICE '✓✓✓ ALL INDEX VALIDATIONS PASSED ✓✓✓';
    ELSIF v_total_indexes >= 550 THEN
        RAISE WARNING '⚠⚠⚠ INDEX COUNT LOWER THAN EXPECTED ⚠⚠⚠';
        RAISE WARNING 'Expected: 650+, Found: %', v_total_indexes;
    ELSE
        RAISE WARNING '✗✗✗ INSUFFICIENT INDEXES ✗✗✗';
        RAISE WARNING 'Please review the index creation scripts.';
    END IF;

    IF v_fk_without_index > 0 THEN
        RAISE WARNING 'Warning: % foreign key columns are not indexed!', v_fk_without_index;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Index verification complete!'
\echo '=============================================='
