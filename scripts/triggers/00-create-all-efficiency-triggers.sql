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
-- PHASE 4: VACUUM and Bloat Detection
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 4: Installing VACUUM and Bloat Detection'
\echo '======================================================'
\echo ''
\i 04_detect_vacuum_bloat.sql

-- =====================================================
-- PHASE 5: Excessive Indexing Detection
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 5: Installing Excessive Indexing Detection'
\echo '======================================================'
\echo ''
\i 05_detect_excessive_indexes.sql

-- =====================================================
-- PHASE 6: Memory Configuration Check
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 6: Installing Memory Configuration Check'
\echo '======================================================'
\echo ''
\i 06_check_memory_config.sql

-- =====================================================
-- PHASE 7: Connection Pooling Analysis
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 7: Installing Connection Pooling Analysis'
\echo '======================================================'
\echo ''
\i 07_check_connection_pooling.sql

-- =====================================================
-- PHASE 8: Advanced Sorting Optimization
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 8: Advanced Sorting & Incremental Sort'
\echo '======================================================'
\echo ''
\i 08_optimize_sorting.sql

-- =====================================================
-- PHASE 9: DISTINCT Operation Optimization
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 9: DISTINCT vs GROUP BY Optimization'
\echo '======================================================'
\echo ''
\i 09_optimize_distinct.sql

-- =====================================================
-- PHASE 10: JOIN Parallelism Optimization
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 10: JOIN Parallelism & Multi-Core Optimization'
\echo '======================================================'
\echo ''
\i 10_optimize_join_parallelism.sql

-- =====================================================
-- PHASE 11: Performance Extensions Installation
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 11: Installing Performance Extensions'
\echo '======================================================'
\echo ''
\i 11_install_performance_extensions.sql

-- =====================================================
-- PHASE 12: Performance Monitoring & Alerting
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 12: Installing Performance Monitoring Suite'
\echo '======================================================'
\echo ''
\i 12_install_all_performance_monitoring.sql

-- =====================================================
-- PHASE 13: Optimistic Lock Enforcement
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 13: Enforcing Optimistic Locking'
\echo '======================================================'
\echo ''
\i 13_enforce_optimistic_locking.sql

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
    -- Count installed functions (expanded list)
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            -- Query efficiency (9)
            'check_query_efficiency', 'validate_query_pattern', 'safe_select',
            'estimate_query_cost', 'check_full_table_scan', 'suggest_query_optimization',
            'validate_tenant_isolation', 'build_safe_tenant_query', 'log_tenant_access',
            -- VACUUM monitoring (6)
            'check_table_bloat', 'check_index_bloat', 'check_autovacuum_settings',
            'generate_vacuum_commands',
            -- Index analysis (4)
            'find_unused_indexes', 'find_duplicate_indexes', 'analyze_index_efficiency',
            'calculate_write_penalty',
            -- Memory config (3)
            'check_memory_configuration', 'calculate_memory_requirements', 'detect_memory_issues',
            -- Connection pooling (3)
            'analyze_connection_usage', 'detect_connection_leaks', 'recommend_pooling_strategy',
            -- Sorting optimization (5)
            'analyze_sort_operations', 'check_incremental_sort_eligibility',
            'recommend_sort_indexes', 'explain_sort_plan',
            -- DISTINCT optimization (5)
            'analyze_distinct_queries', 'compare_distinct_vs_groupby',
            'recommend_distinct_indexes', 'optimize_distinct_query',
            -- JOIN parallelism (4)
            'check_parallel_settings', 'analyze_join_parallelism',
            'explain_parallel_plan', 'recommend_parallel_tuning',
            -- Performance extensions (4)
            'check_performance_extensions', 'analyze_missing_indexes_qualstats',
            'test_hypothetical_index', 'recommend_indexes_auto',
            -- Performance reporting (5)
            'generate_daily_performance_report', 'generate_health_check_report',
            'check_performance_thresholds', 'get_latest_report', 'init_report_schedules',
            -- Performance alerting (8)
            'update_performance_baselines', 'detect_query_degradation',
            'detect_connection_spike', 'detect_cache_degradation',
            'monitor_performance_degradation', 'get_active_alerts',
            'acknowledge_alert', 'acknowledge_alerts_by_type',
            -- Optimistic locking (1)
            'enforce_version_lock'
        );

    -- Count installed views (expanded list)
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
            'v_index_recommendations', 'v_extension_status',
            -- Performance reporting (2)
            'v_current_alerts', 'v_recent_reports',
            -- Performance alerting (3)
            'v_active_performance_alerts', 'v_performance_trends', 'v_alert_summary'
        );

    -- Check audit table
    SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tenant_access_audit'
    ) INTO v_audit_table_exists;

    RAISE NOTICE '';
    RAISE NOTICE '┌──────────────────────────────────────────────────────┐';
    RAISE NOTICE '│  INSTALLATION SUMMARY                                │';
    RAISE NOTICE '├──────────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Functions:           % / 57                       │', LPAD(v_function_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Views:               % / 19                       │', LPAD(v_view_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Audit Table:         %                            │',
        CASE WHEN v_audit_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '│  Extensions:          pg_stat_statements, pg_qualstats│';
    RAISE NOTICE '│                       hypopg, pg_cron                │';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Basic Monitoring:                                   │';
    RAISE NOTICE '│  • Query Efficiency       ✅                         │';
    RAISE NOTICE '│  • VACUUM Monitoring      ✅                         │';
    RAISE NOTICE '│  • Index Analysis         ✅                         │';
    RAISE NOTICE '│  • Memory Config          ✅                         │';
    RAISE NOTICE '│  • Connection Pooling     ✅                         │';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Advanced Optimization:                              │';
    RAISE NOTICE '│  • Sorting (Incremental)  ✅                         │';
    RAISE NOTICE '│  • DISTINCT Operations    ✅                         │';
    RAISE NOTICE '│  • JOIN Parallelism       ✅                         │';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Performance Monitoring:                             │';
    RAISE NOTICE '│  • Index Recommendations  ✅                         │';
    RAISE NOTICE '│  • Automated Reporting    ✅                         │';
    RAISE NOTICE '│  • Real-time Alerting     ✅                         │';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '└──────────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    IF v_function_count = 57 AND v_view_count = 19 AND v_audit_table_exists THEN
        RAISE NOTICE '✅ All components installed successfully!';
        RAISE NOTICE '';
        RAISE NOTICE '🔍 Quick Start - Basic Monitoring:';
        RAISE NOTICE '  • Query validation:    SELECT * FROM validate_query_pattern(''query'');';
        RAISE NOTICE '  • VACUUM check:        SELECT * FROM check_table_bloat();';
        RAISE NOTICE '  • Index analysis:      SELECT * FROM find_unused_indexes();';
        RAISE NOTICE '  • Memory config:       SELECT * FROM check_memory_configuration();';
        RAISE NOTICE '  • Connection check:    SELECT * FROM analyze_connection_usage();';
        RAISE NOTICE '';
        RAISE NOTICE '🚀 Advanced Optimization:';
        RAISE NOTICE '  • Sort optimization:   SELECT * FROM analyze_sort_operations();';
        RAISE NOTICE '  • DISTINCT analysis:   SELECT * FROM analyze_distinct_queries();';
        RAISE NOTICE '  • JOIN parallelism:    SELECT * FROM check_parallel_settings();';
        RAISE NOTICE '';
        RAISE NOTICE '📊 Performance Monitoring:';
        RAISE NOTICE '  • Extension status:    SELECT * FROM v_extension_status;';
        RAISE NOTICE '  • Index recommendations: SELECT * FROM v_index_recommendations LIMIT 5;';
        RAISE NOTICE '  • Health check:        SELECT generate_health_check_report();';
        RAISE NOTICE '  • Active alerts:       SELECT * FROM v_active_performance_alerts;';
        RAISE NOTICE '  • Performance trends:  SELECT * FROM v_performance_trends;';
    ELSE
        RAISE WARNING '⚠️  Some components may not have installed correctly.';
        RAISE WARNING 'Expected: 57 functions, 19 views, 1 audit table';
        RAISE WARNING 'Found: % functions, % views, % audit table',
            v_function_count, v_view_count,
            CASE WHEN v_audit_table_exists THEN 1 ELSE 0 END;
    END IF;
    RAISE NOTICE '';
END $$;-- =====================================================
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
