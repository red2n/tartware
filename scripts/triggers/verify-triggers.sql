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
    '9 expected' AS expected
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'check_query_efficiency',
        'validate_query_pattern',
        'safe_select',
        'estimate_query_cost',
        'check_full_table_scan',
        'suggest_query_optimization',
        'validate_tenant_isolation',
        'build_safe_tenant_query',
        'log_tenant_access'
    );

\echo ''
\echo 'Detailed function list:'
\echo '------------------------------------------------------'

SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'check_query_efficiency',
        'validate_query_pattern',
        'safe_select',
        'estimate_query_cost',
        'check_full_table_scan',
        'suggest_query_optimization',
        'validate_tenant_isolation',
        'build_safe_tenant_query',
        'log_tenant_access'
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
    '3 expected' AS expected
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN (
        'v_query_efficiency_monitor',
        'v_large_tables_monitor',
        'v_suspicious_access_patterns'
    );

\echo ''
\echo 'Detailed view list:'
\echo '------------------------------------------------------'

SELECT
    table_name AS view_name,
    view_definition AS definition_preview
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN (
        'v_query_efficiency_monitor',
        'v_large_tables_monitor',
        'v_suspicious_access_patterns'
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
    'SELECT id, name, email FROM guests WHERE tenant_id = ''123'' AND deleted_at IS NULL LIMIT 100'
);

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
-- 6. TEST TENANT ISOLATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  6. Testing Tenant Isolation Validation'
\echo '======================================================'
\echo ''

\echo 'Test 1: Query WITH tenant filter (should be safe):'
\echo '------------------------------------------------------'
SELECT * FROM validate_tenant_isolation(
    'SELECT id FROM guests WHERE tenant_id = ''123e4567-e89b-12d3-a456-426614174000''::uuid'
);

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
-- 9. SUMMARY REPORT
-- =====================================================
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
            'check_query_efficiency',
            'validate_query_pattern',
            'safe_select',
            'estimate_query_cost',
            'check_full_table_scan',
            'suggest_query_optimization',
            'validate_tenant_isolation',
            'build_safe_tenant_query',
            'log_tenant_access'
        );

    -- Count views
    SELECT COUNT(*) INTO v_view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
        AND table_name IN (
            'v_query_efficiency_monitor',
            'v_large_tables_monitor',
            'v_suspicious_access_patterns'
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
    RAISE NOTICE '┌─────────────────────────────────────────────────┐';
    RAISE NOTICE '│  COMPONENT SUMMARY                              │';
    RAISE NOTICE '├─────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '│  Functions:           % / 9                   │', LPAD(v_function_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Views:               % / 3                   │', LPAD(v_view_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Audit Table:         %                       │',
        CASE WHEN v_audit_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '│  Extensions:          % / 2                   │', LPAD(v_extension_count::TEXT, 3, ' ');
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '└─────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    -- Calculate score
    IF v_function_count >= 9 THEN v_total_score := v_total_score + 40; END IF;
    IF v_view_count >= 3 THEN v_total_score := v_total_score + 30; END IF;
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
        RAISE NOTICE '🎉 All efficiency and security checks are active!';
        RAISE NOTICE '';
        RAISE NOTICE '📋 Usage:';
        RAISE NOTICE '  • Validate queries: SELECT * FROM validate_query_pattern(query);';
        RAISE NOTICE '  • Check efficiency: SELECT * FROM v_query_efficiency_monitor;';
        RAISE NOTICE '  • Monitor tenants: SELECT * FROM validate_tenant_isolation(query);';
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
