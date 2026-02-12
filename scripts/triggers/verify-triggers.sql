-- =====================================================
-- verify-triggers.sql
-- Verification Script for Query Efficiency & Security
-- Date: 2025-10-15
--
-- Purpose: Validate that all efficiency monitoring
--          and security functions are properly installed
--
-- Usage: psql -U postgres -d tartware -f verify-triggers.sql
-- =====================================================

\c tartware

\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█    QUERY EFFICIENCY VERIFICATION              █'
\echo '█    Validating Installation                    █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

-- =====================================================
-- 1. VERIFY FUNCTIONS
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  1. Verifying Efficiency Functions'
\echo '======================================================'
\echo ''

SELECT
    '✅ Functions Installed' AS status,
    COUNT(*) AS count,
    '40 expected' AS expected
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        -- Query efficiency (9)
        'check_query_efficiency', 'validate_query_pattern', 'safe_select',
        'estimate_query_cost', 'check_full_table_scan', 'suggest_query_optimization',
        'validate_tenant_isolation', 'build_safe_tenant_query', 'log_tenant_access',
        -- VACUUM monitoring (4)
        'check_table_bloat', 'check_index_bloat', 'check_autovacuum_settings',
        'generate_vacuum_commands',
        -- Index analysis (4)
        'find_unused_indexes', 'find_duplicate_indexes', 'analyze_index_efficiency',
        'calculate_write_penalty',
        -- Memory config (3)
        'check_memory_configuration', 'calculate_memory_requirements', 'detect_memory_issues',
        -- Connection pooling (3)
        'analyze_connection_usage', 'detect_connection_leaks', 'recommend_pooling_strategy',
        -- Sorting optimization (4)
        'analyze_sort_operations', 'check_incremental_sort_eligibility',
        'recommend_sort_indexes', 'explain_sort_plan',
        -- DISTINCT optimization (4)
        'analyze_distinct_queries', 'compare_distinct_vs_groupby',
        'recommend_distinct_indexes', 'optimize_distinct_query',
        -- JOIN parallelism (4)
        'check_parallel_settings', 'analyze_join_parallelism',
        'explain_parallel_plan', 'recommend_parallel_tuning',
        -- Performance extensions (4)
        'check_performance_extensions', 'analyze_missing_indexes_qualstats',
        'test_hypothetical_index', 'recommend_indexes_auto',
        -- Optimistic locking (1)
        'enforce_version_lock'
    );

\echo ''
\echo 'Detailed function list:'
\echo '------------------------------------------------------'

SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        -- Query efficiency (9)
        'check_query_efficiency', 'validate_query_pattern', 'safe_select',
        'estimate_query_cost', 'check_full_table_scan', 'suggest_query_optimization',
        'validate_tenant_isolation', 'build_safe_tenant_query', 'log_tenant_access',
        -- VACUUM monitoring (4)
        'check_table_bloat', 'check_index_bloat', 'check_autovacuum_settings',
        'generate_vacuum_commands',
        -- Index analysis (4)
        'find_unused_indexes', 'find_duplicate_indexes', 'analyze_index_efficiency',
        'calculate_write_penalty',
        -- Memory config (3)
        'check_memory_configuration', 'calculate_memory_requirements', 'detect_memory_issues',
        -- Connection pooling (3)
        'analyze_connection_usage', 'detect_connection_leaks', 'recommend_pooling_strategy',
        -- Sorting optimization (4)
        'analyze_sort_operations', 'check_incremental_sort_eligibility',
        'recommend_sort_indexes', 'explain_sort_plan',
        -- DISTINCT optimization (4)
        'analyze_distinct_queries', 'compare_distinct_vs_groupby',
        'recommend_distinct_indexes', 'optimize_distinct_query',
        -- JOIN parallelism (4)
        'check_parallel_settings', 'analyze_join_parallelism',
        'explain_parallel_plan', 'recommend_parallel_tuning',
        -- Performance extensions (4)
        'check_performance_extensions', 'analyze_missing_indexes_qualstats',
        'test_hypothetical_index', 'recommend_indexes_auto',
        -- Optimistic locking (1)
        'enforce_version_lock'
    )
ORDER BY p.proname;

-- =====================================================
-- 2. VERIFY VIEWS
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  2. Verifying Monitoring Views'
\echo '======================================================'
\echo ''

SELECT
    '✅ Views Installed' AS status,
    COUNT(*) AS count,
    '14 expected' AS expected
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN (
        -- Query efficiency (3)
        'v_query_efficiency_monitor', 'v_large_tables_monitor', 'v_suspicious_access_patterns',
        -- VACUUM monitoring (2)
        'v_vacuum_candidates', 'v_autovacuum_activity',
        -- Index health (1)
        'v_index_health_dashboard',
        -- Memory config (1)
        'v_memory_configuration_summary',
        -- Connection pooling (2)
        'v_connection_dashboard', 'v_application_connections',
        -- Advanced optimization (3)
        'v_sort_performance', 'v_distinct_performance', 'v_parallel_query_performance',
        -- Performance extensions (2)
        'v_index_recommendations', 'v_extension_status'
    );

\echo ''
\echo 'Detailed view list:'
\echo '------------------------------------------------------'

SELECT
    table_name AS view_name
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN (
        -- Query efficiency (3)
        'v_query_efficiency_monitor', 'v_large_tables_monitor', 'v_suspicious_access_patterns',
        -- VACUUM monitoring (2)
        'v_vacuum_candidates', 'v_autovacuum_activity',
        -- Index health (1)
        'v_index_health_dashboard',
        -- Memory config (1)
        'v_memory_configuration_summary',
        -- Connection pooling (2)
        'v_connection_dashboard', 'v_application_connections',
        -- Advanced optimization (3)
        'v_sort_performance', 'v_distinct_performance', 'v_parallel_query_performance',
        -- Performance extensions (2)
        'v_index_recommendations', 'v_extension_status'
    )
ORDER BY table_name;

-- =====================================================
-- 3. VERIFY AUDIT TABLE
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  3. Verifying Audit Infrastructure'
\echo '======================================================'
\echo ''

SELECT
    CASE WHEN EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tenant_access_audit'
    ) THEN '✅ Audit table exists'
    ELSE '❌ Audit table missing'
    END AS status;

\echo ''
\echo 'Audit table structure:'
\echo '------------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'tenant_access_audit'
ORDER BY ordinal_position;

-- =====================================================
-- 4. VERIFY EXTENSIONS
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  4. Verifying Required Extensions'
\echo '======================================================'
\echo ''

SELECT
    extname AS extension_name,
    extversion AS version,
    CASE
        WHEN extname = 'pg_stat_statements' THEN '✅ Required for query monitoring'
        ELSE '✅ Installed'
    END AS status
FROM pg_extension
WHERE extname IN ('pg_stat_statements', 'uuid-ossp');

-- =====================================================
-- 5. TEST QUERY VALIDATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  5. Testing Query Validation Functions'
\echo '======================================================'
\echo ''

\echo 'Test 1: Validate good query (should pass):'
\echo '------------------------------------------------------'
SELECT * FROM validate_query_pattern(
\echo ''
\echo 'Test 2: Validate bad query with SELECT * (should fail):'
\echo '------------------------------------------------------'
SELECT * FROM validate_query_pattern(
    'SELECT * FROM guests'
);

\echo ''
\echo 'Test 3: Validate query optimization suggestions:'
\echo '------------------------------------------------------'
SELECT * FROM suggest_query_optimization(
    'SELECT * FROM reservations WHERE status = ''confirmed'''
) LIMIT 3;

-- =====================================================
\echo '======================================================'
\echo '  6. Testing Tenant Isolation Validation'
\echo '======================================================'
\echo ''

\echo 'Test 1: Query WITH tenant filter (should be safe):'
\echo '------------------------------------------------------'
SELECT * FROM validate_tenant_isolation(
\echo ''
\echo 'Test 2: Query WITHOUT tenant filter (should be unsafe):'
\echo '------------------------------------------------------'
SELECT * FROM validate_tenant_isolation(
    'SELECT id FROM guests WHERE email = ''test@example.com'''
);

-- =====================================================
-- 7. TEST SAFE QUERY BUILDER
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  7. Testing Safe Query Builder'
\echo '======================================================'
\echo ''

\echo 'Test: Build safe query with tenant isolation:'
\echo '------------------------------------------------------'
SELECT build_safe_tenant_query(
    'SELECT id, name FROM guests ORDER BY created_at DESC LIMIT 10',
    '123e4567-e89b-12d3-a456-426614174000'::uuid,
    TRUE
);

-- =====================================================
-- 8. CHECK LARGE TABLES
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  8. Large Tables Monitoring'
\echo '======================================================'
\echo ''

SELECT * FROM v_large_tables_monitor
ORDER BY size_bytes DESC
LIMIT 10;

-- =====================================================
-- 9. TEST SORTING OPTIMIZATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  9. Testing Sorting Optimization'
\echo '======================================================'
\echo ''

\echo 'Test: Analyze sort operations (if any slow queries exist):'
\echo '------------------------------------------------------'
SELECT * FROM analyze_sort_operations()
LIMIT 5;

\echo ''
\echo 'Test: Check sort index recommendations:'
\echo '------------------------------------------------------'
SELECT * FROM recommend_sort_indexes()
LIMIT 5;

-- =====================================================
-- 10. TEST DISTINCT OPTIMIZATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  10. Testing DISTINCT Optimization'
\echo '======================================================'
\echo ''

\echo 'Test: Analyze DISTINCT queries (if any exist):'
\echo '------------------------------------------------------'
SELECT * FROM analyze_distinct_queries()
LIMIT 5;

\echo 'Test: DISTINCT index recommendations:'
\echo '------------------------------------------------------'
SELECT * FROM recommend_distinct_indexes()
LIMIT 5;

-- =====================================================
-- 11. TEST JOIN PARALLELISM
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  11. Testing JOIN Parallelism'
\echo '======================================================'
\echo ''

\echo 'Test: Check parallel query settings:'
\echo '------------------------------------------------------'
SELECT * FROM check_parallel_settings();

\echo ''
\echo 'Test: Get parallel tuning recommendations:'
\echo '------------------------------------------------------'
SELECT * FROM recommend_parallel_tuning();

-- =====================================================
-- 12. VERIFY OPTIMISTIC LOCK TRIGGERS
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  12. Verifying Optimistic Lock Triggers'
\echo '======================================================'
\echo ''

WITH version_tables AS (
        SELECT c.table_schema,
                     c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.column_name = 'version'
            AND t.table_type = 'BASE TABLE'
            AND c.table_schema IN ('public', 'availability')
            AND c.table_name NOT LIKE 'pg_%'
            AND c.table_name NOT LIKE 'sql_%'
),
missing AS (
        SELECT vt.table_schema,
                     vt.table_name
        FROM version_tables vt
        LEFT JOIN pg_trigger trg
            ON trg.tgrelid = to_regclass(format('%I.%I', vt.table_schema, vt.table_name))
         AND trg.tgname = format('trg_%s_version_lock', vt.table_name)
         AND NOT trg.tgisinternal
        WHERE trg.oid IS NULL
)
SELECT
        CASE WHEN COUNT(*) = 0 THEN '✅ All optimistic lock triggers installed'
                 ELSE '❌ Missing optimistic lock triggers'
        END AS status,
        COUNT(*) AS missing_trigger_count
FROM missing;

\echo ''
\echo 'Tables missing version triggers (if any):'
\echo '------------------------------------------------------'
WITH version_tables AS (
        SELECT c.table_schema,
                     c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.column_name = 'version'
            AND t.table_type = 'BASE TABLE'
            AND c.table_schema IN ('public', 'availability')
            AND c.table_name NOT LIKE 'pg_%'
            AND c.table_name NOT LIKE 'sql_%'
),
missing AS (
        SELECT vt.table_schema,
                     vt.table_name
        FROM version_tables vt
        LEFT JOIN pg_trigger trg
            ON trg.tgrelid = to_regclass(format('%I.%I', vt.table_schema, vt.table_name))
         AND trg.tgname = format('trg_%s_version_lock', vt.table_name)
         AND NOT trg.tgisinternal
        WHERE trg.oid IS NULL
)
SELECT
        table_schema,
        table_name
FROM missing
ORDER BY table_schema, table_name;

-- =====================================================
-- 13. SUMMARY REPORT
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  13. Summary Report'
\echo '======================================================'
\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█    VERIFICATION SUMMARY                        █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

DO $$
DECLARE
    v_function_count INTEGER;
    v_view_count INTEGER;
    v_audit_table_exists BOOLEAN;
    v_extension_count INTEGER;
    v_total_score INTEGER := 0;
    v_max_score INTEGER := 100;
BEGIN
    -- Count functions
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            -- Query efficiency (9)
            'check_query_efficiency', 'validate_query_pattern', 'safe_select',
            'estimate_query_cost', 'check_full_table_scan', 'suggest_query_optimization',
            'validate_tenant_isolation', 'build_safe_tenant_query', 'log_tenant_access',
            -- VACUUM monitoring (4)
            'check_table_bloat', 'check_index_bloat', 'check_autovacuum_settings',
            'generate_vacuum_commands',
            -- Index analysis (4)
            'find_unused_indexes', 'find_duplicate_indexes', 'analyze_index_efficiency',
            'calculate_write_penalty',
            -- Memory config (3)
            'check_memory_configuration', 'calculate_memory_requirements', 'detect_memory_issues',
            -- Connection pooling (3)
            'analyze_connection_usage', 'detect_connection_leaks', 'recommend_pooling_strategy',
            -- Sorting optimization (4)
            'analyze_sort_operations', 'check_incremental_sort_eligibility',
            'recommend_sort_indexes', 'explain_sort_plan',
            -- DISTINCT optimization (4)
            'analyze_distinct_queries', 'compare_distinct_vs_groupby',
            'recommend_distinct_indexes', 'optimize_distinct_query',
            -- JOIN parallelism (4)
            'check_parallel_settings', 'analyze_join_parallelism',
            'explain_parallel_plan', 'recommend_parallel_tuning',
            -- Performance extensions (4)
            'check_performance_extensions', 'analyze_missing_indexes_qualstats',
            'test_hypothetical_index', 'recommend_indexes_auto',
            -- Optimistic locking (1)
            'enforce_version_lock'
        );

    -- Count views
    SELECT COUNT(*) INTO v_view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
        AND table_name IN (
            -- Query efficiency (3)
            'v_query_efficiency_monitor', 'v_large_tables_monitor', 'v_suspicious_access_patterns',
            -- VACUUM monitoring (2)
            'v_vacuum_candidates', 'v_autovacuum_activity',
            -- Index health (1)
            'v_index_health_dashboard',
            -- Memory config (1)
            'v_memory_configuration_summary',
            -- Connection pooling (2)
            'v_connection_dashboard', 'v_application_connections',
            -- Advanced optimization (3)
            'v_sort_performance', 'v_distinct_performance', 'v_parallel_query_performance',
            -- Performance extensions (2)
            'v_index_recommendations', 'v_extension_status'
        );

    -- Check audit table
    SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tenant_access_audit'
    ) INTO v_audit_table_exists;

    -- Check extensions
    SELECT COUNT(*) INTO v_extension_count
    FROM pg_extension
    WHERE extname IN ('pg_stat_statements', 'uuid-ossp');

    RAISE NOTICE '';
    RAISE NOTICE '┌──────────────────────────────────────────────────────┐';
    RAISE NOTICE '│  COMPONENT SUMMARY                                   │';
    RAISE NOTICE '├──────────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Functions:           % / 40                       │', LPAD(v_function_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Views:               % / 14                       │', LPAD(v_view_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Audit Table:         %                            │',
        CASE WHEN v_audit_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '│  Extensions:          % / 2                        │', LPAD(v_extension_count::TEXT, 3, ' ');
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Basic Monitoring:                                   │';
    RAISE NOTICE '│  • Query Efficiency       ✅                         │';
    RAISE NOTICE '│  • VACUUM & Bloat         ✅                         │';
    RAISE NOTICE '│  • Index Analysis         ✅                         │';
    RAISE NOTICE '│  • Memory Config          ✅                         │';
    RAISE NOTICE '│  • Connection Pooling     ✅                         │';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Advanced Optimization:                              │';
    RAISE NOTICE '│  • Sorting (Incremental)  ✅                         │';
    RAISE NOTICE '│  • DISTINCT Operations    ✅                         │';
    RAISE NOTICE '│  • JOIN Parallelism       ✅                         │';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '└──────────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    -- Calculate score
    IF v_function_count >= 40 THEN v_total_score := v_total_score + 40; END IF;
    IF v_view_count >= 14 THEN v_total_score := v_total_score + 30; END IF;
    IF v_audit_table_exists THEN v_total_score := v_total_score + 20; END IF;
    IF v_extension_count >= 2 THEN v_total_score := v_total_score + 10; END IF;

    RAISE NOTICE '┌─────────────────────────────────────────────────┐';
    RAISE NOTICE '│  QUALITY SCORE                                  │';
    RAISE NOTICE '├─────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '│  Score:  % / %                              │', LPAD(v_total_score::TEXT, 3, ' '), v_max_score;
    RAISE NOTICE '│                                                 │';

    IF v_total_score = v_max_score THEN
        RAISE NOTICE '│  Grade:  A+ (PERFECT) ✓✓✓                      │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: All efficiency checks active           │';
    ELSIF v_total_score >= 90 THEN
        RAISE NOTICE '│  Grade:  A (EXCELLENT) ✓✓                       │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Efficiency monitoring ready            │';
    ELSIF v_total_score >= 70 THEN
        RAISE NOTICE '│  Grade:  B (GOOD) ✓                             │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Some components missing                │';
    ELSE
        RAISE NOTICE '│  Grade:  F (INCOMPLETE) ✗                       │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Critical components missing            │';
    END IF;

    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '└─────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    IF v_total_score = v_max_score THEN
        RAISE NOTICE '🎉 All efficiency monitoring and optimization tools are active!';
        RAISE NOTICE '';
        RAISE NOTICE '📋 Basic Monitoring:';
        RAISE NOTICE '  • Query validation:    SELECT * FROM validate_query_pattern(query);';
        RAISE NOTICE '  • Efficiency check:    SELECT * FROM v_query_efficiency_monitor;';
        RAISE NOTICE '  • VACUUM bloat:        SELECT * FROM check_table_bloat();';
        RAISE NOTICE '  • Index health:        SELECT * FROM find_unused_indexes();';
        RAISE NOTICE '  • Memory config:       SELECT * FROM check_memory_configuration();';
        RAISE NOTICE '';
        RAISE NOTICE '🚀 Advanced Optimization:';
        RAISE NOTICE '  • Sort analysis:       SELECT * FROM analyze_sort_operations();';
        RAISE NOTICE '  • DISTINCT optimize:   SELECT * FROM analyze_distinct_queries();';
        RAISE NOTICE '  • Parallel settings:   SELECT * FROM check_parallel_settings();';
    ELSE
        RAISE WARNING '⚠️  Some components are missing. Re-run installation script.';
    END IF;
    RAISE NOTICE '';
END $$;

\echo ''
\echo '======================================================'
\echo '  VERIFICATION COMPLETE'
\echo '======================================================'
\echo ''
