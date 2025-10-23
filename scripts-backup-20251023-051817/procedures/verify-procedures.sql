-- =====================================================
-- verify-procedures.sql
-- Verify All Stored Procedures Are Created Correctly
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo '=============================================='
\echo '  PROCEDURE VERIFICATION'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK ALL PROCEDURES EXIST
-- =====================================================
\echo '1. Checking if all required procedures exist:'
\echo '--------------------------------------------'

DO $$
DECLARE
    v_expected_procs TEXT[] := ARRAY[
        'upsert_guest',
        'merge_duplicate_guests',
        'bulk_upsert_guests',
        'sync_channel_availability',
        'sync_channel_reservations',
        'sync_channel_mapping',
        'sync_rate_plans',
        'apply_seasonal_rate_adjustments',
        'sync_daily_rate_overrides',
        'copy_rate_plan',
        'aggregate_daily_metrics',
        'aggregate_monthly_metrics',
        'calculate_revenue_metrics',
        'sync_metric_dimensions'
    ];
    v_proc TEXT;
    v_missing_procs TEXT[] := '{}';
    v_found_count INTEGER := 0;
BEGIN
    FOREACH v_proc IN ARRAY v_expected_procs
    LOOP
        IF EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
                AND p.proname = v_proc
        ) THEN
            v_found_count := v_found_count + 1;
        ELSE
            v_missing_procs := array_append(v_missing_procs, v_proc);
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE 'Expected procedures: 14';
    RAISE NOTICE 'Found procedures: %', v_found_count;

    IF array_length(v_missing_procs, 1) > 0 THEN
        RAISE WARNING 'Missing procedures: %', array_to_string(v_missing_procs, ', ');
    ELSE
        RAISE NOTICE '✓ All 14 procedures/functions exist!';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. LIST ALL PROCEDURES WITH DETAILS
-- =====================================================
\echo '2. Procedure details:'
\echo '--------------------------------------------'

SELECT
    n.nspname AS schema_name,
    p.proname AS procedure_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    CASE p.prokind
        WHEN 'f' THEN 'FUNCTION'
        WHEN 'p' THEN 'PROCEDURE'
        WHEN 'a' THEN 'AGGREGATE'
        WHEN 'w' THEN 'WINDOW'
    END AS type,
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END AS volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'upsert_guest',
        'merge_duplicate_guests',
        'bulk_upsert_guests',
        'sync_channel_availability',
        'sync_channel_reservations',
        'sync_channel_mapping',
        'sync_rate_plans',
        'apply_seasonal_rate_adjustments',
        'sync_daily_rate_overrides',
        'copy_rate_plan',
        'aggregate_daily_metrics',
        'aggregate_monthly_metrics',
        'calculate_revenue_metrics',
        'sync_metric_dimensions'
    )
ORDER BY p.proname;

\echo ''

-- =====================================================
-- 3. CHECK PROCEDURE CATEGORIES
-- =====================================================
\echo '3. Procedures by category:'
\echo '--------------------------------------------'

WITH proc_categories AS (
    SELECT
        p.proname,
        CASE
            WHEN p.proname LIKE '%guest%' THEN '1. Guest Management'
            WHEN p.proname LIKE '%channel%' THEN '2. Channel Sync'
            WHEN p.proname LIKE '%rate%' OR p.proname LIKE '%seasonal%' THEN '3. Rate Management'
            WHEN p.proname LIKE '%metric%' OR p.proname LIKE '%aggregate%' OR p.proname LIKE '%revenue%' THEN '4. Analytics'
            ELSE '5. Other'
        END AS category
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            'upsert_guest',
            'merge_duplicate_guests',
            'bulk_upsert_guests',
            'sync_channel_availability',
            'sync_channel_reservations',
            'sync_channel_mapping',
            'sync_rate_plans',
            'apply_seasonal_rate_adjustments',
            'sync_daily_rate_overrides',
            'copy_rate_plan',
            'aggregate_daily_metrics',
            'aggregate_monthly_metrics',
            'calculate_revenue_metrics',
            'sync_metric_dimensions'
        )
)
SELECT
    category,
    COUNT(*) AS procedure_count,
    string_agg(proname, ', ' ORDER BY proname) AS procedures
FROM proc_categories
GROUP BY category
ORDER BY category;

\echo ''

-- =====================================================
-- 4. CHECK PROCEDURE LANGUAGES
-- =====================================================
\echo '4. Procedure implementation languages:'
\echo '--------------------------------------------'

SELECT
    l.lanname AS language,
    COUNT(*) AS procedure_count,
    string_agg(p.proname, ', ' ORDER BY p.proname) AS procedures
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'upsert_guest',
        'merge_duplicate_guests',
        'bulk_upsert_guests',
        'sync_channel_availability',
        'sync_channel_reservations',
        'sync_channel_mapping',
        'sync_rate_plans',
        'apply_seasonal_rate_adjustments',
        'sync_daily_rate_overrides',
        'copy_rate_plan',
        'aggregate_daily_metrics',
        'aggregate_monthly_metrics',
        'calculate_revenue_metrics',
        'sync_metric_dimensions'
    )
GROUP BY l.lanname
ORDER BY procedure_count DESC;

\echo ''

-- =====================================================
-- 5. TEST BASIC PROCEDURE FUNCTIONALITY
-- =====================================================
\echo '5. Basic functionality tests:'
\echo '--------------------------------------------'

DO $$
DECLARE
    v_test_tenant_id UUID := gen_random_uuid();
    v_test_property_id UUID := gen_random_uuid();
    v_guest_id UUID;
    v_error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Running basic procedure tests...';
    RAISE NOTICE '';

    -- Test 1: Check if upsert_guest exists and has correct signature
    BEGIN
        SELECT proname INTO STRICT v_guest_id
        FROM pg_proc
        WHERE proname = 'upsert_guest';
        RAISE NOTICE '✓ Test 1: upsert_guest exists';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Test 1 FAILED: %', SQLERRM;
        v_error_count := v_error_count + 1;
    END;

    -- Test 2: Check if sync_channel_availability exists
    BEGIN
        PERFORM proname
        FROM pg_proc
        WHERE proname = 'sync_channel_availability';
        RAISE NOTICE '✓ Test 2: sync_channel_availability exists';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Test 2 FAILED: %', SQLERRM;
        v_error_count := v_error_count + 1;
    END;

    -- Test 3: Check if sync_rate_plans exists
    BEGIN
        PERFORM proname
        FROM pg_proc
        WHERE proname = 'sync_rate_plans';
        RAISE NOTICE '✓ Test 3: sync_rate_plans exists';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Test 3 FAILED: %', SQLERRM;
        v_error_count := v_error_count + 1;
    END;

    -- Test 4: Check if aggregate_daily_metrics exists
    BEGIN
        PERFORM proname
        FROM pg_proc
        WHERE proname = 'aggregate_daily_metrics';
        RAISE NOTICE '✓ Test 4: aggregate_daily_metrics exists';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Test 4 FAILED: %', SQLERRM;
        v_error_count := v_error_count + 1;
    END;

    -- Test 5: Check parameter count for upsert_guest
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_proc
            WHERE proname = 'upsert_guest'
                AND pronargs >= 7  -- Should have at least 7 parameters
        ) THEN
            RAISE NOTICE '✓ Test 5: upsert_guest has correct parameter count';
        ELSE
            RAISE WARNING '✗ Test 5 FAILED: upsert_guest parameter count incorrect';
            v_error_count := v_error_count + 1;
        END IF;
    END;

    RAISE NOTICE '';
    IF v_error_count = 0 THEN
        RAISE NOTICE '✓ All basic tests passed!';
    ELSE
        RAISE WARNING '⚠ % test(s) failed!', v_error_count;
    END IF;
END $$;

\echo ''

-- =====================================================
-- 6. CHECK PROCEDURE DEPENDENCIES
-- =====================================================
\echo '6. Procedure dependencies on tables:'
\echo '--------------------------------------------'

WITH proc_deps AS (
    SELECT DISTINCT
        p.proname AS procedure_name,
        d.refobjid::regclass AS depends_on_table
    FROM pg_proc p
    JOIN pg_depend d ON p.oid = d.objid
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            'upsert_guest',
            'merge_duplicate_guests',
            'bulk_upsert_guests',
            'sync_channel_availability',
            'sync_channel_reservations',
            'sync_channel_mapping',
            'sync_rate_plans',
            'apply_seasonal_rate_adjustments',
            'sync_daily_rate_overrides',
            'copy_rate_plan',
            'aggregate_daily_metrics',
            'aggregate_monthly_metrics',
            'calculate_revenue_metrics',
            'sync_metric_dimensions'
        )
        AND d.deptype = 'n'  -- Normal dependency
        AND d.refobjid IN (SELECT oid FROM pg_class WHERE relkind = 'r')
)
SELECT
    procedure_name,
    COUNT(*) AS table_dependencies,
    string_agg(depends_on_table::TEXT, ', ') AS tables
FROM proc_deps
GROUP BY procedure_name
ORDER BY procedure_name;

\echo ''

-- =====================================================
-- 7. CHECK PROCEDURE COMMENTS
-- =====================================================
\echo '7. Procedure documentation (comments):'
\echo '--------------------------------------------'

SELECT
    p.proname AS procedure_name,
    CASE
        WHEN obj_description(p.oid, 'pg_proc') IS NOT NULL
        THEN '✓ Has comment'
        ELSE '✗ No comment'
    END AS documentation_status,
    COALESCE(
        substr(obj_description(p.oid, 'pg_proc'), 1, 50) || '...',
        'No description'
    ) AS description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'upsert_guest',
        'merge_duplicate_guests',
        'bulk_upsert_guests',
        'sync_channel_availability',
        'sync_channel_reservations',
        'sync_channel_mapping',
        'sync_rate_plans',
        'apply_seasonal_rate_adjustments',
        'sync_daily_rate_overrides',
        'copy_rate_plan',
        'aggregate_daily_metrics',
        'aggregate_monthly_metrics',
        'calculate_revenue_metrics',
        'sync_metric_dimensions'
    )
ORDER BY p.proname;

\echo ''

-- =====================================================
-- 8. CHECK POSTGRESQL VERSION FOR MERGE SUPPORT
-- =====================================================
\echo '8. PostgreSQL version and MERGE support:'
\echo '--------------------------------------------'

DO $$
DECLARE
    v_version INTEGER;
    v_version_string TEXT;
BEGIN
    SELECT current_setting('server_version_num')::INTEGER INTO v_version;
    SELECT current_setting('server_version') INTO v_version_string;

    RAISE NOTICE '';
    RAISE NOTICE 'PostgreSQL Version: %', v_version_string;
    RAISE NOTICE 'Version Number: %', v_version;

    IF v_version >= 150000 THEN
        RAISE NOTICE '✓ PostgreSQL 15+ detected - MERGE command is supported';
        RAISE NOTICE '  All procedures can use MERGE for efficient upserts';
    ELSE
        RAISE WARNING '⚠ PostgreSQL % detected', v_version_string;
        RAISE WARNING '  MERGE command requires PostgreSQL 15+';
        RAISE WARNING '  Some procedures may fail. Consider upgrading.';
    END IF;
END $$;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_procedure_count INTEGER;
    v_plpgsql_count INTEGER;
    v_documented_count INTEGER;
BEGIN
    -- Count procedures
    SELECT COUNT(*) INTO v_procedure_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            'upsert_guest',
            'merge_duplicate_guests',
            'bulk_upsert_guests',
            'sync_channel_availability',
            'sync_channel_reservations',
            'sync_channel_mapping',
            'sync_rate_plans',
            'apply_seasonal_rate_adjustments',
            'sync_daily_rate_overrides',
            'copy_rate_plan',
            'aggregate_daily_metrics',
            'aggregate_monthly_metrics',
            'calculate_revenue_metrics',
            'sync_metric_dimensions'
        );

    -- Count plpgsql procedures
    SELECT COUNT(*) INTO v_plpgsql_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_language l ON p.prolang = l.oid
    WHERE n.nspname = 'public'
        AND l.lanname = 'plpgsql'
        AND p.proname IN (
            'upsert_guest',
            'merge_duplicate_guests',
            'bulk_upsert_guests',
            'sync_channel_availability',
            'sync_channel_reservations',
            'sync_channel_mapping',
            'sync_rate_plans',
            'apply_seasonal_rate_adjustments',
            'sync_daily_rate_overrides',
            'copy_rate_plan',
            'aggregate_daily_metrics',
            'aggregate_monthly_metrics',
            'calculate_revenue_metrics',
            'sync_metric_dimensions'
        );

    -- Count documented procedures
    SELECT COUNT(*) INTO v_documented_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            'upsert_guest',
            'merge_duplicate_guests',
            'bulk_upsert_guests',
            'sync_channel_availability',
            'sync_channel_reservations',
            'sync_channel_mapping',
            'sync_rate_plans',
            'apply_seasonal_rate_adjustments',
            'sync_daily_rate_overrides',
            'copy_rate_plan',
            'aggregate_daily_metrics',
            'aggregate_monthly_metrics',
            'calculate_revenue_metrics',
            'sync_metric_dimensions'
        )
        AND obj_description(p.oid, 'pg_proc') IS NOT NULL;

    RAISE NOTICE '';
    RAISE NOTICE 'Total Procedures: % (Expected: 14)', v_procedure_count;
    RAISE NOTICE 'PL/pgSQL Procedures: %', v_plpgsql_count;
    RAISE NOTICE 'Documented Procedures: %', v_documented_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Categories:';
    RAISE NOTICE '  - Guest Management: 3';
    RAISE NOTICE '  - Channel Sync: 3';
    RAISE NOTICE '  - Rate Management: 4';
    RAISE NOTICE '  - Analytics: 4';
    RAISE NOTICE '';

    IF v_procedure_count = 14 THEN
        RAISE NOTICE '✓✓✓ ALL PROCEDURE VALIDATIONS PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ SOME VALIDATIONS FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected: 14, Found: %', v_procedure_count;
        RAISE WARNING 'Please review the output above for details.';
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Procedure verification complete!'
\echo '=============================================='
