-- =====================================================
-- 00-create-all-efficiency-triggers.sql
-- Master Script for Query Efficiency & Security
-- Date: 2025-10-15
--
-- Purpose: Install all query efficiency monitoring,
--          validation functions, and security checks
--
-- Usage: psql -U postgres -d tartware -f 00-create-all-efficiency-triggers.sql
-- =====================================================

\c tartware

\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█    TARTWARE PMS - QUERY EFFICIENCY SUITE      █'
\echo '█    Installing Monitoring & Security           █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

-- Set error handling
\set ON_ERROR_STOP on

-- =====================================================
-- PHASE 1: Query Efficiency Monitoring
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 1: Installing Query Efficiency Monitoring'
\echo '======================================================'
\echo ''
\i 01_prevent_select_star.sql

-- =====================================================
-- PHASE 2: Full Table Scan Prevention
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 2: Installing Full Table Scan Prevention'
\echo '======================================================'
\echo ''
\i 02_prevent_full_table_scans.sql

-- =====================================================
-- PHASE 3: Tenant Isolation Enforcement
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 3: Installing Tenant Isolation Enforcement'
\echo '======================================================'
\echo ''
\i 03_enforce_tenant_isolation.sql

-- =====================================================
-- Summary Report
-- =====================================================
\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█    INSTALLATION COMPLETE                       █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

DO $$
DECLARE
    v_function_count INTEGER;
    v_view_count INTEGER;
    v_audit_table_exists BOOLEAN;
BEGIN
    -- Count installed functions
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

    -- Count installed views
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

    RAISE NOTICE '';
    RAISE NOTICE '┌─────────────────────────────────────────────────┐';
    RAISE NOTICE '│  INSTALLATION SUMMARY                           │';
    RAISE NOTICE '├─────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '│  Functions:           % / 9                   │', LPAD(v_function_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Views:               % / 3                   │', LPAD(v_view_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Audit Table:         %                       │',
        CASE WHEN v_audit_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '│  Extension:           pg_stat_statements        │';
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '└─────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    IF v_function_count = 9 AND v_view_count = 3 AND v_audit_table_exists THEN
        RAISE NOTICE '✅ All components installed successfully!';
        RAISE NOTICE '';
        RAISE NOTICE '🔍 Quick Start:';
        RAISE NOTICE '  1. Validate query: SELECT * FROM validate_query_pattern(''your query'');';
        RAISE NOTICE '  2. Check efficiency: SELECT * FROM v_query_efficiency_monitor;';
        RAISE NOTICE '  3. Monitor tables: SELECT * FROM v_large_tables_monitor;';
        RAISE NOTICE '  4. Check tenant isolation: SELECT * FROM validate_tenant_isolation(''your query'');';
    ELSE
        RAISE WARNING '⚠️  Some components may not have installed correctly.';
        RAISE WARNING 'Expected: 9 functions, 3 views, 1 audit table';
        RAISE WARNING 'Found: % functions, % views, % audit table',
            v_function_count, v_view_count,
            CASE WHEN v_audit_table_exists THEN 1 ELSE 0 END;
    END IF;
    RAISE NOTICE '';
END $$;

-- =====================================================
-- Usage Examples
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  USAGE EXAMPLES'
\echo '======================================================'
\echo ''
\echo '-- Validate a query before execution'
\echo 'SELECT * FROM validate_query_pattern('
\echo '    ''SELECT id, name FROM guests WHERE tenant_id = uuid_value'');'
\echo ''
\echo '-- Check if query will do full table scan'
\echo 'SELECT * FROM check_full_table_scan('
\echo '    ''SELECT * FROM reservations WHERE status = ''''confirmed'''''');'
\echo ''
\echo '-- Get optimization suggestions'
\echo 'SELECT * FROM suggest_query_optimization('
\echo '    ''SELECT * FROM guests'');'
\echo ''
\echo '-- Build safe query with tenant isolation'
\echo 'SELECT build_safe_tenant_query('
\echo '    ''SELECT id FROM reservations'','
\echo '    ''tenant-uuid''::UUID);'
\echo ''
\echo '-- Monitor query efficiency'
\echo 'SELECT query, efficiency_status, recommendation'
\echo 'FROM v_query_efficiency_monitor'
\echo 'WHERE efficiency_status != ''OK'''
\echo 'LIMIT 10;'
\echo ''
\echo '-- Check large tables'
\echo 'SELECT * FROM v_large_tables_monitor'
\echo 'WHERE risk_level LIKE ''%CRITICAL%'';'
\echo ''
\echo '-- Monitor suspicious access'
\echo 'SELECT * FROM v_suspicious_access_patterns;'
\echo ''

\echo ''
\echo '📚 For more information, see: triggers/README.md'
\echo ''
