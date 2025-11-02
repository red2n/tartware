-- =====================================================
-- 12_install_all_performance_monitoring.sql
-- Master Installation Script for Performance Monitoring
-- Date: 2025-10-15
-- Purpose: Install all performance monitoring components
-- =====================================================

\c tartware

\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█   TARTWARE - PERFORMANCE MONITORING SUITE     █'
\echo '█   Complete Installation                       █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

-- Set error handling
\set ON_ERROR_STOP on

-- =====================================================
-- PHASE 1: Extensions
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 1: Installing Performance Extensions'
\echo '======================================================'
\echo ''
\ir 11_install_performance_extensions.sql

-- =====================================================
-- PHASE 2: Tables
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 2: Creating Reporting & Alerting Tables'
\echo '======================================================'
\echo ''
\ir ../tables/07-analytics/23_performance_reporting_tables.sql
\ir ../tables/07-analytics/24_performance_alerting_tables.sql

-- =====================================================
-- PHASE 3: Reporting Procedures
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 3: Creating Reporting Procedures'
\echo '======================================================'
\echo ''
\ir ../procedures/05_performance_reporting_procedures.sql

-- =====================================================
-- PHASE 4: Alerting Procedures
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  Phase 4: Creating Alerting Procedures'
\echo '======================================================'
\echo ''
\ir ../procedures/06_performance_alerting_procedures.sql

-- =====================================================
-- VERIFICATION & SUMMARY
-- =====================================================
\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█   INSTALLATION COMPLETE                        █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

DO $$
DECLARE
    v_extensions INTEGER;
    v_tables INTEGER;
    v_functions INTEGER;
    v_views INTEGER;
BEGIN
    -- Count components
    SELECT COUNT(*) INTO v_extensions
    FROM pg_extension
    WHERE extname IN ('pg_stat_statements', 'pg_qualstats', 'hypopg', 'pg_cron');

    SELECT COUNT(*) INTO v_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'performance_reports', 'report_schedules', 'performance_thresholds',
        'performance_baselines', 'performance_alerts', 'alert_rules'
    );

    SELECT COUNT(*) INTO v_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'check_performance_extensions', 'analyze_missing_indexes_qualstats',
        'test_hypothetical_index', 'recommend_indexes_auto',
        'generate_daily_performance_report', 'generate_health_check_report',
        'check_performance_thresholds', 'get_latest_report', 'init_report_schedules',
        'update_performance_baselines', 'detect_query_degradation',
        'detect_connection_spike', 'detect_cache_degradation',
        'monitor_performance_degradation', 'get_active_alerts',
        'acknowledge_alert', 'acknowledge_alerts_by_type'
    );

    SELECT COUNT(*) INTO v_views
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name IN (
        'v_index_recommendations', 'v_extension_status',
        'v_current_alerts', 'v_recent_reports',
        'v_active_performance_alerts', 'v_performance_trends', 'v_alert_summary'
    );

    RAISE NOTICE '';
    RAISE NOTICE '┌──────────────────────────────────────────────────────┐';
    RAISE NOTICE '│  INSTALLATION SUMMARY                                │';
    RAISE NOTICE '├──────────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Extensions:      % / 4                            │', LPAD(v_extensions::TEXT, 2, ' ');
    RAISE NOTICE '│  Tables:          % / 6                            │', LPAD(v_tables::TEXT, 2, ' ');
    RAISE NOTICE '│  Functions:       % / 17                           │', LPAD(v_functions::TEXT, 2, ' ');
    RAISE NOTICE '│  Views:           % / 7                            │', LPAD(v_views::TEXT, 2, ' ');
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '│  Components:                                         │';
    RAISE NOTICE '│  • Extension Support      ✅                         │';
    RAISE NOTICE '│  • Index Recommendations  ✅                         │';
    RAISE NOTICE '│  • Performance Reporting  ✅                         │';
    RAISE NOTICE '│  • Anomaly Detection      ✅                         │';
    RAISE NOTICE '│  • Real-time Alerting     ✅                         │';
    RAISE NOTICE '│                                                      │';
    RAISE NOTICE '└──────────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    IF v_functions >= 17 AND v_tables >= 6 AND v_views >= 7 THEN
        RAISE NOTICE '🎉 All performance monitoring components installed!';
        RAISE NOTICE '';
        RAISE NOTICE '📋 Quick Start Commands:';
        RAISE NOTICE '';
        RAISE NOTICE '1. Check extension status:';
        RAISE NOTICE '   SELECT * FROM v_extension_status;';
        RAISE NOTICE '';
        RAISE NOTICE '2. Get index recommendations:';
        RAISE NOTICE '   SELECT * FROM v_index_recommendations;';
        RAISE NOTICE '';
        RAISE NOTICE '3. Generate performance report:';
        RAISE NOTICE '   SELECT generate_daily_performance_report();';
        RAISE NOTICE '   SELECT * FROM get_latest_report(''DAILY_PERFORMANCE'');';
        RAISE NOTICE '';
        RAISE NOTICE '4. Check for performance issues:';
        RAISE NOTICE '   SELECT * FROM monitor_performance_degradation();';
        RAISE NOTICE '   SELECT * FROM v_active_performance_alerts;';
        RAISE NOTICE '';
        RAISE NOTICE '5. View performance trends:';
        RAISE NOTICE '   SELECT * FROM v_performance_trends;';
        RAISE NOTICE '';
        RAISE NOTICE '📅 Setup Automated Monitoring:';
        RAISE NOTICE '';
        RAISE NOTICE 'Option 1 - System Cron:';
        RAISE NOTICE '  # Update baselines every hour';
        RAISE NOTICE '  0 * * * * psql -U postgres -d tartware -c "SELECT update_performance_baselines();"';
        RAISE NOTICE '';
        RAISE NOTICE '  # Check for degradation every 5 minutes';
        RAISE NOTICE '  */5 * * * * psql -U postgres -d tartware -c "SELECT * FROM monitor_performance_degradation();"';
        RAISE NOTICE '';
        RAISE NOTICE '  # Generate daily report at 2 AM';
        RAISE NOTICE '  0 2 * * * psql -U postgres -d tartware -c "SELECT generate_daily_performance_report();"';
        RAISE NOTICE '';
        IF v_extensions >= 4 THEN
            RAISE NOTICE 'Option 2 - pg_cron (Installed):';
            RAISE NOTICE '  SELECT cron.schedule(''update-baselines'', ''0 * * * *'', %);',
                CHR(36) || CHR(36) || 'SELECT update_performance_baselines();' || CHR(36) || CHR(36);
            RAISE NOTICE '';
            RAISE NOTICE '  SELECT cron.schedule(''monitor-performance'', ''*/5 * * * *'', %);',
                CHR(36) || CHR(36) || 'SELECT monitor_performance_degradation();' || CHR(36) || CHR(36);
            RAISE NOTICE '';
            RAISE NOTICE '  SELECT cron.schedule(''daily-report'', ''0 2 * * *'', %);',
                CHR(36) || CHR(36) || 'SELECT generate_daily_performance_report();' || CHR(36) || CHR(36);
            RAISE NOTICE '';
        END IF;
        RAISE NOTICE '📚 Documentation:';
        RAISE NOTICE '  • README: scripts/triggers/README.md';
        RAISE NOTICE '  • Comments: Use \df+ function_name for details';
        RAISE NOTICE '';
    ELSE
        RAISE WARNING '⚠️  Some components may not have installed correctly.';
        RAISE WARNING 'Expected: 17 functions, 6 tables, 7 views';
        RAISE WARNING 'Found: % functions, % tables, % views',
            v_functions, v_tables, v_views;
        RAISE NOTICE '';
        RAISE NOTICE 'Run individual scripts to see specific errors.';
    END IF;
END $$;

\echo ''
\echo '======================================================'
\echo '  USAGE EXAMPLES'
\echo '======================================================'
\echo ''
\echo '-- Test hypothetical index (HypoPG):'
\echo 'SELECT * FROM test_hypothetical_index('
\echo '  ''CREATE INDEX ON guests(email)'','
\echo '  ''SELECT * FROM guests WHERE email = ''''test@example.com'''''');'
\echo ''
\echo '-- Get missing index recommendations:'
\echo 'SELECT * FROM analyze_missing_indexes_qualstats();'
\echo ''
\echo '-- Generate health check:'
\echo 'SELECT generate_health_check_report();'
\echo 'SELECT * FROM get_latest_report(''HEALTH_CHECK'');'
\echo ''
\echo '-- View current alerts:'
\echo 'SELECT * FROM v_current_alerts;'
\echo ''
\echo '-- Acknowledge an alert:'
\echo 'SELECT acknowledge_alert(''alert-uuid-here'', ''your-username'');'
\echo ''

\echo ''
\echo '✅ Performance Monitoring Suite installation complete!'
\echo ''
